// Integração com o Postgres: só roda com TEST_DATABASE_URL (veja `npm run test:db`).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consumePasswordReset, createPasswordReset, findPasswordReset, verifyPassword } from "@/server/auth";
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
  });
});
