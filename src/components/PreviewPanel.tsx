"use client";

import { useEffect, useState } from "react";

/**
 * Coluna da prévia. No computador fica fixa ao lado do editor; no celular (≤ 900px) sai do fluxo,
 * para o editor vir primeiro, e abre em tela cheia por um botão flutuante só com o ícone.
 * O botão some ao rolar para baixo e volta ao rolar para cima, para não cobrir o que se está lendo.
 * O CSS posiciona o botão acima da barra inferior quando há navegação no editor.
 */
export default function PreviewPanel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let waiting = false;
    const onScroll = () => {
      if (waiting) return;
      waiting = true;
      requestAnimationFrame(() => {
        const delta = window.scrollY - last;
        if (Math.abs(delta) > 8) {
          setHidden(delta > 0 && window.scrollY > 80);
          last = window.scrollY;
        }
        waiting = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          <button type="button" className="icon-btn preview-close" onClick={() => setOpen(false)} aria-label="Fechar prévia">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
      <button
        type="button"
        className={`btn btn-primary preview-fab${hidden ? " is-hidden" : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Abrir prévia da página"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="6" y="2" width="12" height="20" rx="3" />
          <path d="M11 18h2" />
        </svg>
      </button>
    </>
  );
}
