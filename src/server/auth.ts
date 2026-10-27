import "server-only";
import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query, queryOne } from "./db";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "lb_session";
/** Só "1": avisa o navegador que há sessão (o menu da home, que é estática, mostra "Meu painel"). Não autentica nada. */
export const LOGGED_COOKIE = "lb_logged";
const SESSION_DAYS = 30;

/** verified: e-mail confirmado (sem isso o painel manda para /login/confirmar). */
export type SessionUser = { id: string; email: string; verified: boolean };

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
  store.set(LOGGED_COOKIE, "1", { sameSite: "lax", path: "/", expires, secure: process.env.NODE_ENV === "production" });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query("delete from sessions where id = $1", [sha256(token)]);
  store.delete(SESSION_COOKIE);
  store.delete(LOGGED_COOKIE);
}

/** Usuário da sessão atual (memoizado por requisição) ou null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return queryOne<SessionUser>(
    `select u.id, u.email, u.email_verified_at is not null as verified
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
       -- O link chegou na caixa de entrada: isso também confirma o e-mail.
       update users set password_hash = $2, email_verified_at = coalesce(email_verified_at, now())
        where id = (select user_id from r) returning id
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
  if (!user.verified) redirect("/login/confirmar");
  return user;
}

const VERIFY_MINUTES = 30;
export const VERIFY_MAX_ATTEMPTS = 5;

const codeHash = (userId: string, code: string) => sha256(`${process.env.APP_SECRET ?? ""}|verify|${userId}|${code}`);

/** Gera um código de 6 dígitos (válido por 30 minutos) e invalida o anterior do usuário. */
export async function createEmailVerification(userId: string) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await query(
    `insert into email_verifications (user_id, code_hash, expires_at)
     values ($1, $2, now() + make_interval(mins => $3))
     on conflict (user_id) do update
       set code_hash = excluded.code_hash, attempts = 0, expires_at = excluded.expires_at, created_at = now()`,
    [userId, codeHash(userId, code), VERIFY_MINUTES],
  );
  return code;
}

/**
 * Confere o código e, se bater, marca o e-mail como confirmado.
 * Cada palpite errado gasta uma das 5 tentativas do código; depois disso (ou expirado) é preciso reenviar.
 */
export async function confirmEmail(userId: string, code: string): Promise<"ok" | "wrong" | "expired"> {
  const row = await queryOne<{ code_hash: string }>(
    `update email_verifications set attempts = attempts + 1
      where user_id = $1 and expires_at > now() and attempts < $2
      returning code_hash`,
    [userId, VERIFY_MAX_ATTEMPTS],
  );
  if (!row) return "expired";

  const expected = Buffer.from(row.code_hash);
  const actual = Buffer.from(codeHash(userId, code));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return "wrong";

  await query("update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1", [userId]);
  await query("delete from email_verifications where user_id = $1", [userId]);
  return "ok";
}

/** Nome e sobrenome informados no cadastro (contas antigas: em branco). */
export async function getUserName(userId: string) {
  const row = await queryOne<{ first_name: string; last_name: string }>(
    "select first_name, last_name from users where id = $1",
    [userId],
  );
  return [row?.first_name, row?.last_name].filter(Boolean).join(" ");
}
