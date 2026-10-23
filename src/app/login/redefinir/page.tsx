import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import Logo from "@/components/Logo";
import PasswordInput from "@/components/PasswordInput";
import { findPasswordReset, RESET_COOKIE } from "@/server/auth";
import { resetPassword } from "../actions";

export const metadata: Metadata = {
  title: "Nova senha",
  robots: { index: false, follow: false },
};

export default async function Redefinir({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const token = (await cookies()).get(RESET_COOKIE)?.value;
  const reset = token ? await findPasswordReset(token) : null;

  return (
    <main className="auth">
      <Logo />
      <div className="auth-card">
        <h1 className="h2 auth-h1">Nova senha</h1>
        {reset ? (
          <>
            <p className="auth-text">Crie uma nova senha para {reset.email}. Você sairá dos outros aparelhos.</p>
            <form action={resetPassword} className="auth-form">
              <div>
                <label className="field-label" htmlFor="password">
                  Nova senha
                </label>
                <PasswordInput id="password" name="password" minLength={8} autoComplete="new-password" />
              </div>
              <div>
                <label className="field-label" htmlFor="confirm">
                  Repita a nova senha
                </label>
                <PasswordInput id="confirm" name="confirm" minLength={8} autoComplete="new-password" />
              </div>
              {error && <p className="notice notice-error">{error}</p>}
              <button className="btn btn-primary">Salvar nova senha</button>
            </form>
          </>
        ) : (
          <p className="notice notice-error">Este link é inválido ou expirou. Peça um novo para redefinir a senha.</p>
        )}
        <p className="auth-switch">
          {reset ? <Link href="/login">Voltar para o login</Link> : <Link href="/login/recuperar">Pedir novo link</Link>}
        </p>
      </div>
    </main>
  );
}
