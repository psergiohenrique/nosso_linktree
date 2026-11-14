"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { EditorFormAction, EditorLink, LinkEditorAccess } from "@/lib/editor";
import LinkFields from "./LinkFields";
import { PaywallButton, openPaywall } from "./Paywall";
import SubmitButton from "./SubmitButton";

/** Fecha a folha quando o envio termina (o aviso aparece na página). */
function CloseWhenDone({ onDone }: { onDone: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) onDone();
    wasPending.current = pending;
  }, [pending, onDone]);
  return null;
}

/** Qualquer elemento com data-new-link abre a folha comum ao painel e ao demo. */
export default function NewLinkSheet({ action, proLayouts, atLimit, limit, pix, trackEvents = false }: LinkEditorAccess & { action: EditorFormAction; trackEvents?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<EditorLink["kind"]>("link");
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
  function onKind(next: string) {
    if (next === "pix" && !pix?.business) {
      openPaywall("pix");
      return;
    }
    if (next === "link" || next === "whatsapp" || next === "pix") setKind(next);
  }
  // O bloco Pix não gasta uma das vagas do Grátis.
  const blocked = atLimit && kind !== "pix";
  return (
    <dialog ref={dialog} className="sheet" aria-labelledby="new-link-title" onClose={() => document.documentElement.classList.remove("no-scroll")} onClick={(e) => e.target === dialog.current && close()}>
      <div className="sheet-grab" aria-hidden="true" />
      <div className="sheet-head">
        <h2 id="new-link-title" className="card-title">Novo link</h2>
        <button type="button" className="icon-btn" onClick={close} aria-label="Fechar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
      </div>
      <form action={action} className="sheet-form" data-posthog-event={trackEvents ? (kind === "pix" ? "pix_block_added" : "link_created") : undefined}>
        <CloseWhenDone onDone={close} />
        <div className="sheet-body">
          <div>
            <label className="field-label" htmlFor="new-kind">Tipo</label>
            <select id="new-kind" name="kind" className="field field-select" value={kind} onChange={(e) => onKind(e.target.value)}><option value="link">Link comum</option><option value="whatsapp">WhatsApp</option>{pix && <option value="pix">Pix (plano Business)</option>}</select>
          </div>
          <LinkFields kind={kind} proLayouts={proLayouts} />
        </div>
        <div className="sheet-footer">
          {blocked ? <><PaywallButton feature="links" className="btn btn-primary">Adicionar link</PaywallButton><p className="hint">Você chegou aos {limit} links do plano Grátis. Com o Pro, são ilimitados.</p></> : <SubmitButton pendingLabel="Adicionando…">Adicionar link</SubmitButton>}
        </div>
      </form>
    </dialog>
  );
}
