import type { Metadata } from "next";
import Logo from "@/components/Logo";
import { sendMagicLink } from "./actions";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <main className="auth">
      <Logo />
      <div className="auth-card">
        <h1 className="h2 auth-h1">Entrar ou criar conta</h1>
        {sent ? (
          <p className="notice notice-ok">Enviamos um link para o seu e-mail. Abra-o para entrar.</p>
        ) : (
          <>
            <p className="auth-text">Sem senha: enviamos um link de acesso para o seu e-mail.</p>
            <form action={sendMagicLink} className="auth-form">
              <div>
                <label className="field-label" htmlFor="email">
                  Seu e-mail
                </label>
                <input id="email" name="email" type="email" required autoComplete="email" className="field" />
              </div>
              {error && <p className="notice notice-error">{error}</p>}
              <button className="btn btn-primary">Receber link de acesso</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
