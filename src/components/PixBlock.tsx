"use client";

import { useId, useRef, useState } from "react";

/**
 * Bloco Pix na página: QR (SVG vindo do servidor) e o BR Code para copiar.
 * A chave é de quem recebe. Este componente não chama banco nem gateway.
 */
export default function PixBlock({ title, code, svg }: { title: string; code: string; svg: string | null }) {
  const fieldId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    // O aviso aparece na hora: em alguns navegadores clipboard.writeText não resolve
    // (permissão pendente) e o botão ficaria parado em "Copiar código".
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        return;
      }
    } catch {
      // Sem permissão de clipboard: seleciona o código para copiar na mão.
    }
    field.current?.focus();
    field.current?.select();
    try {
      document.execCommand("copy");
    } catch {
      // O campo continua selecionado.
    }
  }

  return (
    <section className="bio-pix" aria-label={title}>
      <h2 className="bio-pix-title">{title}</h2>
      {svg && <div className="bio-pix-qr" dangerouslySetInnerHTML={{ __html: svg }} />}
      <p className="bio-pix-hint">O pagamento cai direto na chave de quem recebe. O Linkbio não fica com o dinheiro.</p>
      <label className="bio-pix-label" htmlFor={fieldId}>
        Copia e cola
      </label>
      <textarea
        id={fieldId}
        ref={field}
        className="bio-pix-code"
        readOnly
        rows={3}
        value={code}
        spellCheck={false}
        aria-label="Código Pix copia e cola"
      />
      <button type="button" className="bio-pix-copy" onClick={copy}>
        {copied ? "Código copiado" : "Copiar código"}
      </button>
    </section>
  );
}
