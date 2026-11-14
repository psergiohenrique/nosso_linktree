import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import { LOGIN_LINK_COOKIE, maskEmail } from "@/lib/login-link";
import { findLoginLink } from "@/server/auth";
import { consumeMagicLink } from "../actions";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Confirmação do link. O token chega num cookie httpOnly; esta página não o consome. */
export default async function Entrar() {
  const token = (await cookies()).get(LOGIN_LINK_COOKIE)?.value ?? "";
  const link = token ? await findLoginLink(token) : null;
  if (link && link.status !== "valid") redirect("/login/entrar/falha");
  const valid = link?.status === "valid" ? link : null;

  return (
    <main className="auth">
      <Logo />
      <div className="auth-card">
        <h1 className="h2 auth-h1">Entrar</h1>
        {valid ? (
          <>
            <p className="auth-text">
              Entrar como <strong className="ph-no-capture">{maskEmail(valid.email)}</strong>?
            </p>
            <form action={consumeMagicLink} className="auth-form">
              <button className="btn btn-primary">Entrar</button>
            </form>
          </>
        ) : (
          <p className="notice notice-error">Este link é inválido, expirou ou já foi usado.</p>
        )}
        <p className="auth-switch">
          {valid ? <Link href="/login">Voltar para o login</Link> : <Link href="/login/link">Pedir novo link</Link>}
        </p>
      </div>
    </main>
  );
}
