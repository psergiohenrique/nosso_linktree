"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOGIN_LINK_COOKIE, LOGIN_LINK_MINUTES, LOGIN_LINK_PATH } from "@/lib/login-link";
import {
  confirmEmail,
  consumeLoginLink,
  consumePasswordReset,
  createEmailVerification,
  createLoginLink,
  createPasswordReset,
  createSession,
  destroySession,
  findLoginLink,
  getCurrentUser,
  hashPassword,
  RESET_COOKIE,
  verifyPassword,
} from "@/server/auth";
import { query, queryOne } from "@/server/db";
import { sendMail } from "@/server/mail";
import { captureAuthEvent } from "@/server/posthog-events";
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
    ? await queryOne<{ id: string; password_hash: string | null }>("select id, password_hash from users where email = $1", [email])
    : null;
  // Mesma mensagem para e-mail inexistente e senha errada.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await recordAttempt("signin", keys);
    back("E-mail ou senha incorretos.");
  }

  await clearAttempts("signin", { email });
  await createSession(user.id);
  after(() => captureAuthEvent({ event: "login_succeeded", distinctId: user.id, method: "password" }));
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

  // E-mail que já tem conta confirmada: recusa. Conta nunca confirmada com esse e-mail (ex.: alguém digitou
  // o endereço errado) é reaproveitada com os dados novos; só entra quem receber o código.
  const user = await queryOne<{ id: string }>(
    `insert into users (email, password_hash, first_name, last_name, instagram) values ($1, $2, $3, $4, $5)
     on conflict (email) do update
       set password_hash = excluded.password_hash, first_name = excluded.first_name,
           last_name = excluded.last_name, instagram = excluded.instagram
       where users.email_verified_at is null
     returning id`,
    [email, await hashPassword(password), values.first_name, values.last_name, instagram || null],
  );
  if (!user) return fail("Já existe uma conta com esse e-mail.");

  // Sessões de um cadastro anterior não confirmado deixam de valer.
  await query("delete from sessions where user_id = $1", [user.id]);
  const sent = await sendVerificationCode(user.id, email, values.first_name);
  await createSession(user.id);
  redirect(sent ? "/login/confirmar" : `/login/confirmar?error=${encodeURIComponent(MAIL_FAILED)}`);
}

const MAIL_FAILED = "Não conseguimos enviar o código agora. Tente reenviar em instantes.";

async function sendVerificationCode(userId: string, email: string, firstName: string) {
  const code = await createEmailVerification(userId);
  const hello = firstName ? `Olá, ${firstName}!` : "Olá!";
  return sendMail({
    to: email,
    // O nome vem primeiro: a caixa de entrada do celular corta o fim de assuntos longos.
    subject: `${SITE_NAME}: seu código de confirmação é ${code}`,
    text: `${hello}\n\nSeu código para confirmar o e-mail no ${SITE_NAME} é:\n\n${code}\n\nEle vale por 30 minutos. Se não foi você que se cadastrou, ignore este e-mail.`,
    html: `<p>${escapeHtml(hello)}</p><p>Seu código para confirmar o e-mail no ${SITE_NAME} é:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p><p>Ele vale por 30 minutos. Se não foi você que se cadastrou, ignore este e-mail.</p>`,
  });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function backToConfirm(message: string): never {
  redirect(`/login/confirmar?error=${encodeURIComponent(message)}`);
}

/** Passo 2 do cadastro: confere o código enviado por e-mail. */
export async function verifyEmail(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.verified) redirect("/dashboard");

  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) backToConfirm("Digite os 6 números do código.");

  const result = await confirmEmail(user.id, code);
  if (result === "wrong") backToConfirm("Código incorreto. Confira o e-mail e tente de novo.");
  if (result === "expired") backToConfirm("Esse código expirou ou teve tentativas demais. Peça um novo abaixo.");
  redirect("/dashboard");
}

export async function resendVerification() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.verified) redirect("/dashboard");

  const keys = { email: user.email };
  if (await isRateLimited("verify", keys)) backToConfirm(RATE_LIMIT_MESSAGE);
  await recordAttempt("verify", keys);

  const row = await queryOne<{ first_name: string }>("select first_name from users where id = $1", [user.id]);
  if (!(await sendVerificationCode(user.id, user.email, row?.first_name ?? ""))) backToConfirm(MAIL_FAILED);
  redirect("/login/confirmar?enviado=1");
}

/** E-mail digitado errado: sai e volta ao passo 1 (o cadastro não confirmado pode ser refeito). */
export async function restartSignup() {
  await destroySession();
  redirect("/login?modo=cadastro");
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

  // A busca, a criação do token e o envio ficam fora da resposta: o tempo dela não revela se a conta existe.
  after(async () => {
    try {
      const user = await queryOne<{ id: string }>("select id from users where email = $1", [email]);
      if (!user) return;
      const token = await createPasswordReset(user.id);
      const link = `${SITE_URL}/api/redefinir-senha?token=${token}`;
      await sendMail({
        to: email,
        subject: `Redefinir sua senha — ${SITE_NAME}`,
        text: `Recebemos um pedido para redefinir a senha da sua conta no ${SITE_NAME}.\n\nAbra o link abaixo (vale por 1 hora):\n${link}\n\nSe não foi você, ignore este e-mail; sua senha continua a mesma.`,
        html: `<p>Recebemos um pedido para redefinir a senha da sua conta no ${SITE_NAME}.</p><p><a href="${link}">Criar nova senha</a> (o link vale por 1 hora).</p><p>Se não foi você, ignore este e-mail; sua senha continua a mesma.</p>`,
      });
    } catch (err) {
      console.error("[auth] falha ao enviar a redefinição de senha", err);
    }
  });
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

export type MagicLinkState = {
  error?: string;
  sent?: boolean;
  /** O que a pessoa digitou, para reenviar sem colocar o e-mail na URL. */
  email?: string;
  /** Muda a cada envio e reinicia a espera do botão Reenviar. */
  sentAt?: number;
};

/** Pede um link de entrada. A resposta é a mesma exista ou não a conta. */
export async function requestMagicLink(prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "E-mail inválido.", email };

  const keys = { email, ip: (await clientIp()) || undefined };
  if (await isRateLimited("magic", keys)) {
    return { error: RATE_LIMIT_MESSAGE, email, sent: prev.sent, sentAt: prev.sentAt };
  }
  await recordAttempt("magic", keys);

  // A busca, a criação do link e o envio ficam fora da resposta: o tempo dela não revela se a conta existe.
  after(async () => {
    try {
      const user = await queryOne<{ id: string }>("select id from users where email = $1", [email]);
      if (!user) return;
      const token = await createLoginLink(user.id);
      const link = `${SITE_URL}/login/entrar?token=${encodeURIComponent(token)}`;
      const minutes = String(LOGIN_LINK_MINUTES);
      await sendMail({
        to: email,
        subject: `Entrar sem senha — ${SITE_NAME}`,
        text: `Recebemos um pedido para entrar na sua conta do ${SITE_NAME} sem senha.\n\nAbra o link abaixo (vale por ${minutes} minutos). Ele funciona neste ou em outro aparelho:\n${link}\n\nNa página, confirme que quer entrar. Se não foi você, ignore este e-mail: ninguém acessa a conta só de receber a mensagem.`,
        html: `<p>Recebemos um pedido para entrar na sua conta do ${SITE_NAME} sem senha.</p><p><a href="${link}">Entrar agora</a> (o link vale por ${minutes} minutos e funciona neste ou em outro aparelho).</p><p>Na página, confirme que quer entrar. Se não foi você, ignore este e-mail: ninguém acessa a conta só de receber a mensagem.</p>`,
      });
      await captureAuthEvent({ event: "magic_link_requested", distinctId: user.id });
    } catch (err) {
      console.error("[auth] falha ao enviar o link de entrada", err);
    }
  });
  return { sent: true, email, sentAt: Date.now() };
}

/** O botão da página de confirmação. O GET do link não passa por aqui. */
export async function consumeMagicLink() {
  const store = await cookies();
  const token = store.get(LOGIN_LINK_COOKIE)?.value ?? "";
  if (!token) redirect("/login/entrar");

  const userId = await consumeLoginLink(token);
  store.delete({ name: LOGIN_LINK_COOKIE, path: LOGIN_LINK_PATH });
  if (!userId) {
    const link = await findLoginLink(token);
    const reason = link.status === "valid" ? "invalid" : link.status;
    after(() =>
      captureAuthEvent({
        event: "magic_link_login_failed",
        distinctId: link.userId ?? "",
        reason,
      }),
    );
    redirect("/login/entrar");
  }

  after(() => captureAuthEvent({ event: "magic_link_login_succeeded", distinctId: userId }));
  await createSession(userId);
  redirect("/dashboard");
}
