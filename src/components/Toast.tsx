"use client";

import { useState } from "react";

/**
 * Aviso por cima da tela (não some de vista ao rolar). O de sucesso se apaga sozinho (CSS);
 * o de erro fica até ser fechado. Use `key` para mostrar de novo a cada envio.
 */
export default function Toast({ kind = "ok", children }: { kind?: "ok" | "error"; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className={`toast toast-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <svg className="toast-dot" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {kind === "ok" ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M12 7v6m0 4h.01" />}
      </svg>
      <span>{children}</span>
      {kind === "error" && (
        <button type="button" className="toast-close" onClick={() => setOpen(false)} aria-label="Fechar aviso">
          ×
        </button>
      )}
    </div>
  );
}
