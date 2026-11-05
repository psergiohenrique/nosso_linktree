"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import ImageField from "./ImageField";
import LinkOptions from "./LinkOptions";
import { PaywallButton } from "./Paywall";
import SubmitButton from "./SubmitButton";

/** Fecha a folha quando o envio termina (com sucesso ou não: o aviso aparece na página). */
function CloseWhenDone({ onDone }: { onDone: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) onDone();
    wasPending.current = pending;
  }, [pending, onDone]);
  return null;
}

/**
 * Formulário de "Novo link" numa folha: sobe da base no celular, centralizada no computador.
 * Qualquer elemento com `data-new-link` na página a abre.
 */
export default function NewLinkSheet({
  action,
  proLayouts,
  atLimit,
  limit,
}: {
  action: (formData: FormData) => Promise<void>;
  proLayouts: boolean;
  atLimit: boolean;
  limit: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<"link" | "whatsapp">("link");

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-new-link]")) return;
      dialog.current?.showModal();
      document.documentElement.classList.add("no-scroll");
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      document.documentElement.classList.remove("no-scroll");
    };
  }, []);

  const close = () => dialog.current?.close();
  const whats = kind === "whatsapp";

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby="new-link-title"
      onClose={() => document.documentElement.classList.remove("no-scroll")}
      onClick={(e) => e.target === dialog.current && close()}
    >
      <div className="sheet-grab" aria-hidden="true" />
      <div className="sheet-head">
        <h2 id="new-link-title" className="card-title">
          Novo link
        </h2>
        <button type="button" className="icon-btn" onClick={close} aria-label="Fechar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <form action={action} className="sheet-form" data-posthog-event="link_created">
        <CloseWhenDone onDone={close} />
        <div>
          <label className="field-label" htmlFor="new-kind">
            Tipo
          </label>
          <select id="new-kind" name="kind" className="field field-select" value={kind} onChange={(e) => setKind(e.target.value as "link" | "whatsapp")}>
            <option value="link">Link comum</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="new-title">
            Título
          </label>
          <input id="new-title" name="title" required maxLength={80} placeholder={whats ? "Ex.: Falar no WhatsApp" : "Ex.: Agendar horário"} className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="new-url">
            {whats ? "WhatsApp com DDD" : "Link"}
          </label>
          <input
            id="new-url"
            name="url"
            required
            placeholder={whats ? "11 99999-9999" : "https://…"}
            inputMode={whats ? "tel" : "url"}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="field"
          />
        </div>
        {whats && (
          <div>
            <label className="field-label" htmlFor="new-message">
              Mensagem inicial <span className="field-optional">(opcional)</span>
            </label>
            <input id="new-message" name="message" placeholder="Ex.: Quero agendar" className="field" />
          </div>
        )}
        <LinkOptions proLayouts={proLayouts} />
        <div>
          <span className="field-label">
            Imagem <span className="field-optional">(opcional; boa para Destaque e Bloco)</span>
          </span>
          <ImageField name="thumbnail" />
        </div>
        {/* No limite do Grátis o formulário continua aberto; o botão mostra o aviso do Pro. */}
        {atLimit ? (
          <>
            <PaywallButton feature="links" className="btn btn-primary">
              Adicionar link
            </PaywallButton>
            <p className="hint">Você chegou aos {limit} links do plano Grátis. Com o Pro, são ilimitados.</p>
          </>
        ) : (
          <SubmitButton pendingLabel="Adicionando…">Adicionar link</SubmitButton>
        )}
      </form>
    </dialog>
  );
}
