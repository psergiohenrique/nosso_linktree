// Integração com o Postgres: só roda com TEST_DATABASE_URL (veja `npm run test:db`).
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  confirmEmail,
  consumeLoginLink,
  consumePasswordReset,
  createEmailVerification,
  createLoginLink,
  createPasswordReset,
  findLoginLink,
  findPasswordReset,
  purgeExpiredLoginLinks,
  VERIFY_MAX_ATTEMPTS,
  verifyPassword,
} from "@/server/auth";
import { pool, query, queryOne } from "@/server/db";
import { clearAttempts, isRateLimited, RATE_RULES, recordAttempt } from "@/server/rate-limit";

describe.skipIf(!process.env.TEST_DATABASE_URL)("banco: segurança da conta", () => {
  const email = `teste-${randomUUID()}@exemplo.com`;
  let userId = "";

  beforeAll(async () => {
    const row = await queryOne<{ id: string }>(
      "insert into users (email, password_hash) values ($1, 'scrypt$x$y') returning id",
      [email],
    );
    userId = row!.id;
  });

  afterAll(async () => {
    await query("delete from users where id = $1", [userId]);
    await pool.end();
  });

  describe("limite de tentativas", () => {
    it("bloqueia o e-mail após o máximo de falhas no login e libera ao limpar", async () => {
      const keys = { email };
      const { max } = RATE_RULES.signin.email!;
      for (let i = 0; i < max - 1; i++) await recordAttempt("signin", keys);
      expect(await isRateLimited("signin", keys)).toBe(false);

      await recordAttempt("signin", keys);
      expect(await isRateLimited("signin", keys)).toBe(true);
      // Outra ação com a mesma chave não é afetada.
      expect(await isRateLimited("reset", keys)).toBe(false);

      await clearAttempts("signin", keys);
      expect(await isRateLimited("signin", keys)).toBe(false);
    });

    it("conta por IP independentemente do e-mail", async () => {
      const ip = `203.0.113.${Math.floor(Math.random() * 250)}-${randomUUID()}`;
      const { max } = RATE_RULES.signup.ip!;
      for (let i = 0; i < max; i++) await recordAttempt("signup", { ip });
      expect(await isRateLimited("signup", { ip })).toBe(true);
      await clearAttempts("signup", { ip });
    });

    it("bloqueia o 4º pedido de link mágico na mesma hora", async () => {
      const keys = { email };
      expect(RATE_RULES.magic.email).toEqual({ max: 3, minutes: 60 });
      expect(RATE_RULES.magic.ip).toEqual({ max: 10, minutes: 60 });
      const { max } = RATE_RULES.magic.email!;
      for (let i = 0; i < max; i++) {
        expect(await isRateLimited("magic", keys)).toBe(false);
        await recordAttempt("magic", keys);
      }
      expect(await isRateLimited("magic", keys)).toBe(true);
      // Outra ação com a mesma chave não é afetada.
      expect(await isRateLimited("reset", keys)).toBe(false);
      const leaked = await queryOne("select 1 from auth_attempts where key_hash like $1", [`%${email}%`]);
      expect(leaked).toBeNull();
      await clearAttempts("magic", keys);
    });

    it("não grava o e-mail em texto puro", async () => {
      await recordAttempt("reset", { email });
      const leaked = await queryOne("select 1 from auth_attempts where key_hash like $1", [`%${email}%`]);
      expect(leaked).toBeNull();
      await clearAttempts("reset", { email });
    });
  });

  describe("recuperação de senha", () => {
    it("troca a senha uma única vez e encerra as sessões", async () => {
      await query("insert into sessions (id, user_id, expires_at) values ($1, $2, now() + interval '1 day')", [
        `sessao-${randomUUID()}`,
        userId,
      ]);
      const token = await createPasswordReset(userId);
      expect(await findPasswordReset(token)).toEqual({ email });

      expect(await consumePasswordReset(token, "nova-senha-123")).toBe(userId);
      const user = await queryOne<{ password_hash: string }>("select password_hash from users where id = $1", [userId]);
      expect(await verifyPassword("nova-senha-123", user!.password_hash)).toBe(true);
      expect(await queryOne("select 1 from sessions where user_id = $1", [userId])).toBeNull();

      // Reuso do mesmo link falha.
      expect(await findPasswordReset(token)).toBeNull();
      expect(await consumePasswordReset(token, "outra-senha-123")).toBeNull();
    });

    it("um novo pedido invalida o link anterior", async () => {
      const first = await createPasswordReset(userId);
      const second = await createPasswordReset(userId);
      expect(await findPasswordReset(first)).toBeNull();
      expect(await findPasswordReset(second)).toEqual({ email });
    });

    it("link expirado não vale", async () => {
      const token = await createPasswordReset(userId);
      await query("update password_resets set expires_at = now() - interval '1 minute' where user_id = $1", [userId]);
      expect(await findPasswordReset(token)).toBeNull();
      expect(await consumePasswordReset(token, "nova-senha-123")).toBeNull();
    });

    it("token desconhecido não vale", async () => {
      expect(await findPasswordReset("token-inventado-que-nao-existe")).toBeNull();
    });

    it("redefinir a senha pelo link confirma o e-mail", async () => {
      await query("update users set email_verified_at = null where id = $1", [userId]);
      const token = await createPasswordReset(userId);
      await consumePasswordReset(token, "nova-senha-123");
      expect(await isVerified()).toBe(true);
    });
  });

  const isVerified = async () =>
    (await queryOne<{ v: boolean }>("select email_verified_at is not null as v from users where id = $1", [userId]))!.v;

  const passwordHash = async () =>
    (await queryOne<{ p: string | null }>("select password_hash as p from users where id = $1", [userId]))!.p;

  describe("link mágico", () => {
    it("conta já confirmada: entra uma única vez e mantém as sessões e a senha", async () => {
      await query("update users set email_verified_at = now(), password_hash = 'scrypt$x$y' where id = $1", [userId]);
      const sessionId = `sessao-magic-${randomUUID()}`;
      await query("insert into sessions (id, user_id, expires_at) values ($1, $2, now() + interval '1 day')", [
        sessionId,
        userId,
      ]);
      const token = await createLoginLink(userId);
      expect(await findLoginLink(token)).toEqual({ status: "valid", email, userId });

      expect(await consumeLoginLink(token)).toBe(userId);
      expect(await isVerified()).toBe(true);
      expect(await queryOne("select 1 from sessions where id = $1", [sessionId])).not.toBeNull();
      expect(await passwordHash()).toBe("scrypt$x$y");
      await query("delete from sessions where id = $1", [sessionId]);

      expect((await findLoginLink(token)).status).toBe("used");
      expect(await consumeLoginLink(token)).toBeNull();
    });

    it("conta não confirmada: confirma o e-mail, apaga todas as sessões e anula a senha", async () => {
      await query("update users set email_verified_at = null, password_hash = 'scrypt$x$y' where id = $1", [userId]);
      const sessionIds = [`sessao-a-${randomUUID()}`, `sessao-b-${randomUUID()}`];
      for (const id of sessionIds) {
        await query("insert into sessions (id, user_id, expires_at) values ($1, $2, now() + interval '1 day')", [id, userId]);
      }
      const token = await createLoginLink(userId);

      expect(await consumeLoginLink(token)).toBe(userId);
      expect(await isVerified()).toBe(true);
      expect(await passwordHash()).toBeNull();
      for (const id of sessionIds) expect(await queryOne("select 1 from sessions where id = $1", [id])).toBeNull();
    });

    it("sessões de outra conta não são tocadas", async () => {
      const other = await queryOne<{ id: string }>(
        "insert into users (email, password_hash) values ($1, 'scrypt$x$y') returning id",
        [`outra-${randomUUID()}@exemplo.com`],
      );
      const otherSession = `sessao-outra-${randomUUID()}`;
      await query("insert into sessions (id, user_id, expires_at) values ($1, $2, now() + interval '1 day')", [
        otherSession,
        other!.id,
      ]);
      await query("update users set email_verified_at = null where id = $1", [userId]);
      expect(await consumeLoginLink(await createLoginLink(userId))).toBe(userId);
      expect(await queryOne("select 1 from sessions where id = $1", [otherSession])).not.toBeNull();
      expect(await queryOne<{ p: string }>("select password_hash as p from users where id = $1", [other!.id])).toEqual({
        p: "scrypt$x$y",
      });
      await query("delete from users where id = $1", [other!.id]);
    });

    it("link inválido não apaga sessões nem a senha de conta não confirmada", async () => {
      await query("update users set email_verified_at = null, password_hash = 'scrypt$x$y' where id = $1", [userId]);
      const sessionId = `sessao-intacta-${randomUUID()}`;
      await query("insert into sessions (id, user_id, expires_at) values ($1, $2, now() + interval '1 day')", [
        sessionId,
        userId,
      ]);
      const token = await createLoginLink(userId);
      await query("update login_links set expires_at = now() - interval '1 minute' where user_id = $1", [userId]);
      expect(await consumeLoginLink(token)).toBeNull();
      expect(await queryOne("select 1 from sessions where id = $1", [sessionId])).not.toBeNull();
      expect(await passwordHash()).toBe("scrypt$x$y");
      await query("delete from sessions where id = $1", [sessionId]);
    });

    it("não grava o token em claro e vale cerca de 15 minutos", async () => {
      const token = await createLoginLink(userId);
      const row = await queryOne<{ id: string; expires_at: Date }>(
        "select id, expires_at from login_links where user_id = $1",
        [userId],
      );
      const hash = createHash("sha256").update(token).digest("hex");
      expect(row!.id).toBe(hash);
      expect(await queryOne("select 1 from login_links where id = $1", [token])).toBeNull();
      const delta = new Date(row!.expires_at).getTime() - Date.now();
      expect(delta).toBeGreaterThan(14 * 60 * 1000);
      expect(delta).toBeLessThan(16 * 60 * 1000);
    });

    it("um novo pedido invalida o link anterior", async () => {
      const first = await createLoginLink(userId);
      const second = await createLoginLink(userId);
      expect((await findLoginLink(first)).status).toBe("invalid");
      expect(await findLoginLink(second)).toEqual({ status: "valid", email, userId });
    });

    it("link expirado não entra nem confirma o e-mail", async () => {
      await query("update users set email_verified_at = null where id = $1", [userId]);
      const token = await createLoginLink(userId);
      await query("update login_links set expires_at = now() - interval '1 minute' where user_id = $1", [userId]);
      expect((await findLoginLink(token)).status).toBe("expired");
      expect(await consumeLoginLink(token)).toBeNull();
      expect(await isVerified()).toBe(false);
    });

    it("link usado e vencido conta como usado", async () => {
      const token = await createLoginLink(userId);
      expect(await consumeLoginLink(token)).toBe(userId);
      await query("update login_links set expires_at = now() - interval '1 minute' where user_id = $1", [userId]);
      expect((await findLoginLink(token)).status).toBe("used");
    });

    it("token desconhecido não vale", async () => {
      expect((await findLoginLink("token-inventado-que-nao-existe")).status).toBe("invalid");
      expect(await consumeLoginLink("token-inventado-que-nao-existe")).toBeNull();
    });

    it("não mexe na data de confirmação de quem já confirmou", async () => {
      await query("update users set email_verified_at = '2020-01-01T00:00:00Z' where id = $1", [userId]);
      const token = await createLoginLink(userId);
      expect(await consumeLoginLink(token)).toBe(userId);
      const row = await queryOne<{ t: Date }>("select email_verified_at as t from users where id = $1", [userId]);
      expect(new Date(row!.t).toISOString()).toBe("2020-01-01T00:00:00.000Z");
    });

    it("a limpeza apaga o que venceu há mais de um dia e conserva o recente", async () => {
      const old = await createLoginLink(userId);
      await query("update login_links set expires_at = now() - interval '2 days' where user_id = $1", [userId]);
      expect(await purgeExpiredLoginLinks()).toBeGreaterThanOrEqual(1);
      expect((await findLoginLink(old)).status).toBe("invalid");

      const recent = await createLoginLink(userId);
      await query("update login_links set expires_at = now() - interval '1 minute' where user_id = $1", [userId]);
      await purgeExpiredLoginLinks();
      expect((await findLoginLink(recent)).status).toBe("expired");

      const used = await createLoginLink(userId);
      await consumeLoginLink(used);
      await query(
        "update login_links set used_at = now() - interval '2 days', expires_at = now() - interval '2 days' where user_id = $1",
        [userId],
      );
      await purgeExpiredLoginLinks();
      expect((await findLoginLink(used)).status).toBe("invalid");
    });
  });

  describe("confirmação de e-mail", () => {
    const wrongOf = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

    it("código certo confirma e não pode ser reusado", async () => {
      await query("update users set email_verified_at = null where id = $1", [userId]);
      const code = await createEmailVerification(userId);
      expect(code).toMatch(/^\d{6}$/);
      expect(await confirmEmail(userId, wrongOf(code))).toBe("wrong");
      expect(await isVerified()).toBe(false);

      expect(await confirmEmail(userId, code)).toBe("ok");
      expect(await isVerified()).toBe(true);
      expect(await confirmEmail(userId, code)).toBe("expired");
    });

    it("esgota as tentativas e o reenvio libera um código novo", async () => {
      await query("update users set email_verified_at = null where id = $1", [userId]);
      const code = await createEmailVerification(userId);
      for (let i = 0; i < VERIFY_MAX_ATTEMPTS; i++) expect(await confirmEmail(userId, wrongOf(code))).toBe("wrong");
      // Nem o código certo vale depois do limite.
      expect(await confirmEmail(userId, code)).toBe("expired");

      const fresh = await createEmailVerification(userId);
      expect(await confirmEmail(userId, fresh)).toBe("ok");
    });

    it("código expirado não vale", async () => {
      await query("update users set email_verified_at = null where id = $1", [userId]);
      const code = await createEmailVerification(userId);
      await query("update email_verifications set expires_at = now() - interval '1 minute' where user_id = $1", [userId]);
      expect(await confirmEmail(userId, code)).toBe("expired");
      expect(await isVerified()).toBe(false);
    });
  });
});
