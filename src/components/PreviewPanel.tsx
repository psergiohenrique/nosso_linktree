"use client";

import { useEffect, useState } from "react";

/**
 * Coluna da prévia. No computador fica fixa ao lado do editor; no celular (≤ 900px) sai do fluxo,
 * para o editor vir primeiro, e abre em tela cheia pelo botão flutuante "Prévia".
 */
export default function PreviewPanel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", close);
    document.documentElement.classList.add("no-scroll");
    return () => {
      document.removeEventListener("keydown", close);
      document.documentElement.classList.remove("no-scroll");
    };
  }, [open]);

  return (
    <>
      <div
        className={`preview-col${open ? " preview-open" : ""}`}
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-label={open ? "Prévia da página" : undefined}
      >
        <div className="preview-head">
          <p className="eyebrow">Prévia</p>
          <button type="button" className="btn btn-outline btn-sm preview-close" onClick={() => setOpen(false)}>
            Fechar
          </button>
        </div>
        {children}
      </div>
      <button type="button" className="btn btn-primary preview-fab" onClick={() => setOpen(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="6" y="2" width="12" height="20" rx="3" />
          <path d="M11 18h2" />
        </svg>
        Prévia
      </button>
    </>
  );
}
