"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  consumePasswordReset,
  createPasswordReset,
  createSession,
  destroySession,
  hashPassword,
  RESET_COOKIE,
  verifyPassword,
} from "@/server/auth";
import { queryOne } from "@/server/db";
import { sendMail } from "@/server/mail";
import { clearAttempts, clientIp, isRateLimited, RATE_LIMIT_MESSAGE, recordAttempt } from "@/server/rate-limit";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { instagramHandle } from "@/lib/validation";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function back(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

function passwordError(password: string) {
  return password.length < 8 || password.length > 200 ? "A senha precisa ter pelo menos 8 caracteres." : null;
}

export async function signIn(formData: FormData) {
  const { email, password } = readCredentials(formData);
  const validEmail = EMAIL.test(email);
  const keys = { email: validEmail ? email : undefined, ip: (await clientIp()) || undefined };
  if (await isRateLimited("signin", keys)) back(RATE_LIMIT_MESSAGE);

  const user = validEmail
    ? await queryOne<{ id: string; password_hash: string }>("select id, password_hash from users where email = $1", [email])
    : null;
  // Mesma mensagem para e-mail inexistente e senha errada.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await recordAttempt("signin", keys);
    back("E-mail ou senha incorretos.");
  }

  await clearAttempts("signin", { email });
  await createSession(user.id);
  redirect("/dashboard");
}

export type SignUpState = {
  error?: string;
  /** O que foi digitado (menos as senhas), para o formulário não voltar vazio depois de um erro. */
  values?: { first_name: string; last_name: string; instagram: string; email: string };
};

export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const { email, password } = readCredentials(formData);
  const values = {
    first_name: String(formData.get("first_name") ?? "").trim().slice(0, 60),
    last_name: String(formData.get("last_name") ?? "").trim().slice(0, 60),
    instagram: String(formData.get("instagram") ?? "").trim().slice(0, 200),
    email,
  };
  const fail = (error: string): SignUpState => ({ error, values });

  const keys = { ip: (await clientIp()) || undefined };
  if (await isRateLimited("signup", keys)) return fail(RATE_LIMIT_MESSAGE);
  await recordAttempt("signup", keys);

  if (!values.first_name) return fail("Informe seu nome.");
  if (!values.last_name) return fail("Informe seu sobrenome.");
  const instagram = instagramHandle(values.instagram);
  if (instagram === null) return fail("Instagram inválido: use só o usuário, como @seunegocio.");
  if (!EMAIL.test(email)) return fail("E-mail inválido.");
  const invalid = passwordError(password);
  if (invalid) return fail(invalid);
  if (password !== String(formData.get("confirm") ?? "")) return fail("As senhas não conferem.");

  const user = await queryOne<{ id: string }>(
    `insert into users (email, password_hash, first_name, last_name, instagram) values ($1, $2, $3, $4, $5)
     on conflict (email) do nothing returning id`,
    [email, await hashPassword(password), values.first_name, values.last_name, instagram || null],
  );
  if (!user) return fail("Já existe uma conta com esse e-mail.");

  await createSession(user.id);
  redirect("/dashboard");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}

/** Envia o link de redefinição. A resposta é a mesma exista ou não a conta. */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) redirect(`/login/recuperar?error=${encodeURIComponent("E-mail inválido.")}`);

  const keys = { email, ip: (await clientIp()) || undefined };
  if (await isRateLimited("reset", keys)) redirect(`/login/recuperar?error=${encodeURIComponent(RATE_LIMIT_MESSAGE)}`);
  await recordAttempt("reset", keys);

  const user = await queryOne<{ id: string }>("select id from users where email = $1", [email]);
  if (user) {
    const token = await createPasswordReset(user.id);
    const link = `${SITE_URL}/api/redefinir-senha?token=${token}`;
    await sendMail({
      to: email,
      subject: `Redefinir sua senha — ${SITE_NAME}`,
      text: `Recebemos um pedido para redefinir a senha da sua conta no ${SITE_NAME}.\n\nAbra o link abaixo (vale por 1 hora):\n${link}\n\nSe não foi você, ignore este e-mail; sua senha continua a mesma.`,
      html: `<p>Recebemos um pedido para redefinir a senha da sua conta no ${SITE_NAME}.</p><p><a href="${link}">Criar nova senha</a> (o link vale por 1 hora).</p><p>Se não foi você, ignore este e-mail; sua senha continua a mesma.</p>`,
    });
  }
  redirect("/login/recuperar?enviado=1");
}

export async function resetPassword(formData: FormData) {
  const store = await cookies();
  const token = store.get(RESET_COOKIE)?.value;
  if (!token) redirect("/login/redefinir");

  const password = String(formData.get("password") ?? "");
  const invalid =
    passwordError(password) ?? (password !== String(formData.get("confirm") ?? "") ? "As senhas não conferem." : null);
  if (invalid) redirect(`/login/redefinir?error=${encodeURIComponent(invalid)}`);

  const userId = await consumePasswordReset(token, password);
  store.delete(RESET_COOKIE);
  if (!userId) redirect("/login/redefinir");

  await createSession(userId);
  redirect("/dashboard");
}
