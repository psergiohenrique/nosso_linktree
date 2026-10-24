import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import SignupSteps from "@/components/SignupSteps";
import { getCurrentUser } from "@/server/auth";
import { resendVerification, restartSignup, verifyEmail } from "../actions";

export const metadata: Metadata = {
  title: "Confirmar e-mail",
  robots: { index: false, follow: false },
};

/** Passo 2 do cadastro: o código de 6 dígitos que foi para o e-mail. */
export default async function Confirmar({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.verified) redirect("/dashboard");
  const { enviado, error } = await searchParams;

  return (
    <main className="auth">
      <Logo />
      <div className="auth-card">
        <SignupSteps current={2} />
        <h1 className="h2 auth-h1">Confirme seu e-mail</h1>
        <p className="auth-text">
          Enviamos um código de 6 números para <strong>{user.email}</strong>. Ele vale por 30 minutos.
        </p>
        <form action={verifyEmail} className="auth-form">
          <div>
            <label className="field-label" htmlFor="code">
              Código
            </label>
            <input
              id="code"
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              placeholder="000000"
              autoFocus
              className="field field-code"
            />
          </div>
          {error && <p className="notice notice-error">{error}</p>}
          {enviado && !error && <p className="notice notice-ok">Enviamos um novo código.</p>}
          <button className="btn btn-primary">Confirmar</button>
        </form>
        <p className="auth-switch">Não chegou? Veja a caixa de spam ou peça outro.</p>
        <div className="auth-actions">
          <form action={resendVerification}>
            <button className="btn btn-outline btn-sm">Reenviar código</button>
          </form>
          <form action={restartSignup}>
            <button className="btn btn-outline btn-sm">Usar outro e-mail</button>
          </form>
        </div>
      </div>
    </main>
  );
}
