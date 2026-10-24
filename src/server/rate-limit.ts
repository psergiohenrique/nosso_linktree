import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { query } from "./db";

/**
 * Limite de tentativas contra força bruta em login, cadastro e recuperação de senha.
 * Cada tentativa vira uma linha em `auth_attempts`, com a chave em hash (segredo + e-mail ou IP).
 */

export type AuthAction = "signin" | "signup" | "reset" | "verify";
type KeyKind = "email" | "ip";
export type AttemptKeys = Partial<Record<KeyKind, string>>;

// No login só as falhas contam (e o sucesso zera as do e-mail); no cadastro, na recuperação e no reenvio, todo pedido conta.
export const RATE_RULES: Record<AuthAction, Partial<Record<KeyKind, { max: number; minutes: number }>>> = {
  signin: { email: { max: 5, minutes: 15 }, ip: { max: 30, minutes: 15 } },
  signup: { ip: { max: 5, minutes: 60 } },
  reset: { email: { max: 3, minutes: 60 }, ip: { max: 10, minutes: 60 } },
  // Reenvio do código de confirmação do cadastro.
  verify: { email: { max: 5, minutes: 60 } },
};

export const RATE_LIMIT_MESSAGE = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";

export function attemptKey(action: AuthAction, kind: KeyKind, value: string) {
  return createHash("sha256")
    .update(`${process.env.APP_SECRET ?? ""}|${action}|${kind}|${value}`)
    .digest("hex");
}

/** Pares (tipo, hash) das chaves informadas que têm regra para a ação. */
function ruleKeys(action: AuthAction, keys: AttemptKeys) {
  return (Object.keys(RATE_RULES[action]) as KeyKind[])
    .filter((kind) => keys[kind])
    .map((kind) => ({ kind, rule: RATE_RULES[action][kind]!, hash: attemptKey(action, kind, keys[kind]!) }));
}

/** IP do visitante (primeiro de x-forwarded-for), ou "" se não houver. */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
}

export async function isRateLimited(action: AuthAction, keys: AttemptKeys) {
  const counts = await Promise.all(
    ruleKeys(action, keys).map(async ({ rule, hash }) => {
      const rows = await query<{ n: string }>(
        `select count(*) as n from auth_attempts
          where action = $1 and key_hash = $2 and created_at > now() - make_interval(mins => $3)`,
        [action, hash, rule.minutes],
      );
      return Number(rows[0]?.n ?? 0) >= rule.max;
    }),
  );
  return counts.some(Boolean);
}

export async function recordAttempt(action: AuthAction, keys: AttemptKeys) {
  const hashes = ruleKeys(action, keys).map((k) => k.hash);
  if (hashes.length === 0) return;
  await query("insert into auth_attempts (action, key_hash) select $1, unnest($2::text[])", [action, hashes]);
  // Limpeza ocasional: nenhuma regra olha mais de 1 hora para trás.
  if (Math.random() < 0.02) await query("delete from auth_attempts where created_at < now() - interval '1 day'");
}

export async function clearAttempts(action: AuthAction, keys: AttemptKeys) {
  const hashes = ruleKeys(action, keys).map((k) => k.hash);
  if (hashes.length === 0) return;
  await query("delete from auth_attempts where action = $1 and key_hash = any($2::text[])", [action, hashes]);
}
