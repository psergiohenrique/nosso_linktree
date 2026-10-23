"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { useEffect } from "react";
import Logo from "@/components/Logo";

/**
 * Erro inesperado numa página (ex.: o painel aberto desde antes de uma nova versão no ar).
 * Mostra um aviso no lugar da tela preta do Next e deixa recarregar.
 */
export default function ErrorPage({ error }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
    if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
      posthog.captureException(error);
    }
  }, [error]);

  return (
    <main className="auth">
      <Logo />
      <div className="auth-card">
        <h1 className="h2 auth-h1">Algo deu errado</h1>
        <p className="auth-text">
          Não conseguimos concluir essa ação. Recarregue a página e tente de novo; se continuar, fale com a gente.
        </p>
        {/* Recarrega a página inteira: resolve também o caso de uma versão nova ter entrado no ar. */}
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Recarregar a página
        </button>
        <p className="auth-switch">
          <Link href="/dashboard">Voltar ao painel</Link>
        </p>
        {error.digest && <p className="hint">Código do erro: {error.digest}</p>}
      </div>
    </main>
  );
}
