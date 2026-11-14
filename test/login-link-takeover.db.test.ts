// Integração com o Postgres: só roda com TEST_DATABASE_URL (veja `npm run test:db`).
// Cenário: o atacante cadastra o e-mail da vítima (o cadastro aceita qualquer endereço) e a vítima
// entra pelo link mágico. O atacante não pode ficar com a sessão nem com a senha.
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import {
  consumeLoginLink,
  createLoginLink,
  createSession,
  hashPassword,
  requireUser,
  SESSION_COOKIE,
  verifyPassword,
} from "@/server/auth";
import { pool, query, queryOne } from "@/server/db";

describe.skipIf(!process.env.TEST_DATABASE_URL)("banco: tomada de conta pelo link mágico", () => {
  const email = `vitima-${randomUUID()}@exemplo.com`;
  const attackerPassword = "senha-do-atacante-123";
  let userId = "";

  beforeEach(async () => {
    jar.clear();
    await query("delete from users where email = $1", [email]);
    // O atacante cadastra o e-mail da vítima, com a senha dele, e fica com uma sessão.
    const row = await queryOne<{ id: string }>(
      "insert into users (email, password_hash) values ($1, $2) returning id",
      [email, await hashPassword(attackerPassword)],
    );
    userId = row!.id;
  });

  afterAll(async () => {
    await query("delete from users where email = $1", [email]);
    await pool.end();
  });

  it("a sessão do atacante deixa de valer e a senha dele não entra mais quando a vítima confirma pelo link", async () => {
    await createSession(userId);
    const attackerToken = jar.get(SESSION_COOKIE)!;
    // Antes: a conta não confirmada só chega até o passo de confirmação.
    await expect(requireUser()).rejects.toThrow("REDIRECT /login/confirmar");

    // A vítima recebe o link no e-mail dela, abre e confirma.
    const link = await createLoginLink(userId);
    expect(await consumeLoginLink(link)).toBe(userId);

    // Sem a correção, a sessão do atacante passaria a valer aqui, já com o e-mail confirmado.
    jar.clear();
    jar.set(SESSION_COOKIE, attackerToken);
    await expect(requireUser()).rejects.toThrow("REDIRECT /login");
    expect(await queryOne("select 1 from sessions where user_id = $1", [userId])).toBeNull();

    // A senha antiga não entra: o hash foi anulado e a conferência recusa.
    const row = await queryOne<{ password_hash: string | null }>("select password_hash from users where id = $1", [userId]);
    expect(row!.password_hash).toBeNull();
    expect(await verifyPassword(attackerPassword, row!.password_hash)).toBe(false);

    // A vítima entra com a sessão nova, criada depois do consumo.
    jar.clear();
    await createSession(userId);
    await expect(requireUser()).resolves.toMatchObject({ id: userId, email, verified: true });
  });

  it("conta já confirmada: a sessão e a senha continuam valendo", async () => {
    await query("update users set email_verified_at = now() where id = $1", [userId]);
    await createSession(userId);
    const sessionToken = jar.get(SESSION_COOKIE)!;

    expect(await consumeLoginLink(await createLoginLink(userId))).toBe(userId);

    jar.clear();
    jar.set(SESSION_COOKIE, sessionToken);
    await expect(requireUser()).resolves.toMatchObject({ id: userId });
    const row = await queryOne<{ password_hash: string }>("select password_hash from users where id = $1", [userId]);
    expect(await verifyPassword(attackerPassword, row!.password_hash)).toBe(true);
  });

  it("verifyPassword recusa hash nulo ou vazio sem lançar erro", async () => {
    expect(await verifyPassword("qualquer-senha", null)).toBe(false);
    expect(await verifyPassword("qualquer-senha", "")).toBe(false);
  });
});
