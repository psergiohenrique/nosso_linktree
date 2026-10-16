"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/server/auth";
import { queryOne } from "@/server/db";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function back(mode: "entrar" | "cadastro", message: string): never {
  redirect(`/login?modo=${mode}&error=${encodeURIComponent(message)}`);
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(formData: FormData) {
  const { email, password } = readCredentials(formData);
  const user = EMAIL.test(email)
    ? await queryOne<{ id: string; password_hash: string }>("select id, password_hash from users where email = $1", [email])
    : null;
  // Mesma mensagem para e-mail inexistente e senha errada.
  if (!user || !(await verifyPassword(password, user.password_hash))) back("entrar", "E-mail ou senha incorretos.");

  await createSession(user.id);
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const { email, password } = readCredentials(formData);
  if (!EMAIL.test(email)) back("cadastro", "E-mail inválido.");
  if (password.length < 8 || password.length > 200) back("cadastro", "A senha precisa ter pelo menos 8 caracteres.");

  const user = await queryOne<{ id: string }>(
    "insert into users (email, password_hash) values ($1, $2) on conflict (email) do nothing returning id",
    [email, await hashPassword(password)],
  );
  if (!user) back("cadastro", "Já existe uma conta com esse e-mail.");

  await createSession(user.id);
  redirect("/dashboard");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}
