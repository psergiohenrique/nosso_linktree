import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import MagicLinkForm from "@/components/MagicLinkForm";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = {
  title: "Entrar sem senha",
  robots: { index: false, follow: false },
};

export default async function LinkMagico() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="auth">
      <Logo />
      <div className="auth-card">
        <h1 className="h2 auth-h1">Entrar sem senha</h1>
        <MagicLinkForm />
        <p className="auth-switch">
          Prefere usar senha? <Link href="/login">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
