import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import { getCurrentUser } from "@/server/auth";
import { signIn, signUp } from "./actions";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { modo, error } = await searchParams;
  const signup = modo === "cadastro";

  return (
    <main className="auth">
      <Logo />
      <div className="auth-card">
        <h1 className="h2 auth-h1">{signup ? "Criar conta" : "Entrar"}</h1>
        <p className="auth-text">
          {signup ? "Crie sua conta e monte sua página em minutos." : "Acesse o painel da sua página."}
        </p>
        <form action={signup ? signUp : signIn} className="auth-form">
          <div>
            <label className="field-label" htmlFor="email">
              E-mail
            </label>
            <input id="email" name="email" type="email" required autoComplete="email" className="field" />
          </div>
          <div>
            <label className="field-label" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={signup ? 8 : undefined}
              autoComplete={signup ? "new-password" : "current-password"}
              className="field"
            />
          </div>
          {error && <p className="notice notice-error">{error}</p>}
          <button className="btn btn-primary">{signup ? "Criar conta" : "Entrar"}</button>
        </form>
        {!signup && (
          <p className="auth-switch">
            <Link href="/login/recuperar">Esqueci minha senha</Link>
          </p>
        )}
        <p className="auth-switch">
          {signup ? "Já tem conta? " : "Ainda não tem conta? "}
          <Link href={signup ? "/login" : "/login?modo=cadastro"}>{signup ? "Entrar" : "Criar conta"}</Link>
        </p>
      </div>
    </main>
  );
}
