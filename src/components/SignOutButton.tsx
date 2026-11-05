"use client";

import { useId, useRef } from "react";
import SubmitButton from "./SubmitButton";

/**
 * "Sair" do painel, com confirmação (um toque sem querer não derruba a sessão).
 * No celular vira só o ícone; o rótulo continua para leitores de tela.
 */
export default function SignOutButton({ action }: { action: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const textId = useId();

  return (
    <>
      <button type="button" className="btn btn-outline btn-sm hdr-btn" onClick={() => dialog.current?.showModal()}>
        <span className="hdr-label">Sair</span>
        <svg className="hdr-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5M21 12H9" />
        </svg>
        <span className="sr-only hdr-sr">Sair da conta</span>
      </button>
      <dialog ref={dialog} className="paywall confirm-dialog" aria-labelledby={titleId} aria-describedby={textId}>
        <div className="paywall-content">
          <h2 id={titleId} className="paywall-title">Sair da conta?</h2>
          <p id={textId} className="paywall-text">Para voltar ao painel, você vai precisar entrar de novo com seu e-mail e senha.</p>
          <form action={action} data-posthog-logout="true" className="confirm-actions">
            <button type="button" className="btn btn-outline" onClick={() => dialog.current?.close()} autoFocus>
              Cancelar
            </button>
            <SubmitButton pendingLabel="Saindo…">Sair</SubmitButton>
          </form>
        </div>
      </dialog>
    </>
  );
}
