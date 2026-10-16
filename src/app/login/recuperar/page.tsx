import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import { requestPasswordReset } from "../actions";

export const metadata: Metadata = {
  title: "Recuperar senha",
  robots: { index: false, follow: false },
};

export default async function Recuperar({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string; error?: string }>;
}) {
  const { enviado, error } = await searchParams;

  return (
    <main className="auth">
      <Logo />
      <div className="auth-card">
        <h1 className="h2 auth-h1">Recuperar senha</h1>
        {enviado ? (
          <p className="notice notice-ok">
            Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha. Ele vale por 1 hora.
          </p>
        ) : (
          <>
            <p className="auth-text">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
            <form action={requestPasswordReset} className="auth-form">
              <div>
                <label className="field-label" htmlFor="email">
                  E-mail
                </label>
                <input id="email" name="email" type="email" required autoComplete="email" className="field" />
              </div>
              {error && <p className="notice notice-error">{error}</p>}
              <button className="btn btn-primary">Enviar link</button>
            </form>
          </>
        )}
        <p className="auth-switch">
          Lembrou a senha? <Link href="/login">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
