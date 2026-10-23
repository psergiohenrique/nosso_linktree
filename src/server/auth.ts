import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query, queryOne } from "./db";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "lb_session";
const SESSION_DAYS = 30;

export type SessionUser = { id: string; email: string };

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(expected, actual);
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query("insert into sessions (id, user_id, expires_at) values ($1, $2, $3)", [sha256(token), userId, expires]);

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query("delete from sessions where id = $1", [sha256(token)]);
  store.delete(SESSION_COOKIE);
}

/** Usuário da sessão atual (memoizado por requisição) ou null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return queryOne<SessionUser>(
    `select u.id, u.email
       from sessions s join users u on u.id = s.user_id
      where s.id = $1 and s.expires_at > now()`,
    [sha256(token)],
  );
});

export const RESET_COOKIE = "lb_reset";
const RESET_MINUTES = 60;

/** Cria um token de redefinição de senha (válido por 1 hora) e invalida os anteriores do usuário. */
export async function createPasswordReset(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await query("delete from password_resets where user_id = $1", [userId]);
  await query(
    "insert into password_resets (id, user_id, expires_at) values ($1, $2, now() + make_interval(mins => $3))",
    [sha256(token), userId, RESET_MINUTES],
  );
  return token;
}

/** E-mail do dono do token, se o token ainda vale. */
export async function findPasswordReset(token: string) {
  return queryOne<{ email: string }>(
    `select u.email from password_resets r join users u on u.id = r.user_id
      where r.id = $1 and r.used_at is null and r.expires_at > now()`,
    [sha256(token)],
  );
}

/**
 * Troca a senha usando o token (uma única vez) e encerra todas as sessões do usuário.
 * Retorna o id do usuário ou null se o token for inválido, usado ou expirado.
 */
export async function consumePasswordReset(token: string, newPassword: string) {
  const row = await queryOne<{ id: string }>(
    `with r as (
       update password_resets set used_at = now()
        where id = $1 and used_at is null and expires_at > now()
        returning user_id
     ), u as (
       update users set password_hash = $2 where id = (select user_id from r) returning id
     ), s as (
       delete from sessions where user_id = (select id from u)
     )
     select id from u`,
    [sha256(token), await hashPassword(newPassword)],
  );
  return row?.id ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Nome e sobrenome informados no cadastro (contas antigas: em branco). */
export async function getUserName(userId: string) {
  const row = await queryOne<{ first_name: string; last_name: string }>(
    "select first_name, last_name from users where id = $1",
    [userId],
  );
  return [row?.first_name, row?.last_name].filter(Boolean).join(" ");
}
