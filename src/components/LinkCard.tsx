"use client";

import type { EditorFormAction, EditorLink } from "@/lib/editor";
import DeleteLinkButton from "./DeleteLinkButton";
import LinkFields, { splitWhatsapp } from "./LinkFields";
import { WhatsappIcon } from "./PageView";
import { Chevron } from "./Section";
import SubmitButton from "./SubmitButton";

type Props = {
  link: EditorLink;
  updateAction: EditorFormAction;
  deleteAction: EditorFormAction;
  proLayouts: boolean;
  trackEvents?: boolean;
  onDraftChange?: (data: FormData) => void;
  onImageFile?: (file: File | null) => void;
};

export default function LinkCard({ link, updateAction, deleteAction, proLayouts, trackEvents = false, onDraftChange, onImageFile }: Props) {
  const wa = link.kind === "whatsapp" ? splitWhatsapp(link.url) : null;
  return (
    <details className={`link-card ${link.is_active ? "" : "card-off"}`}>
      <summary className="link-sum">
        {link.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={link.thumbnail_url} alt="" width={40} height={40} className="link-thumb" loading="lazy" />
        ) : (
          <div className={`link-thumb link-thumb-empty ${wa ? "link-thumb-whats" : ""}`} aria-hidden="true">
            {wa ? <WhatsappIcon className="link-thumb-icon" /> : (
              <svg className="link-thumb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
                <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
              </svg>
            )}
          </div>
        )}
        <span className="link-sum-text">
          <span className="link-sum-title">{link.title}</span>
          <span className="link-sum-url">{wa ? `WhatsApp ${wa.phone}` : link.url.replace(/^https?:\/\//, "")}</span>
        </span>
        {!link.is_active && <span className="link-tag">Inativo</span>}
        <Chevron />
      </summary>
      <div className="link-body">
        <form
          action={updateAction}
          className="link-form"
          data-posthog-event={trackEvents ? "link_updated" : undefined}
          onChange={onDraftChange ? (event) => {
            // O arquivo só chega ao adaptador depois da redução assíncrona em ImageInput.
            if (event.target instanceof HTMLInputElement && event.target.type === "file") return;
            onDraftChange(new FormData(event.currentTarget));
          } : undefined}
        >
          <input type="hidden" name="id" value={link.id} />
          <input type="hidden" name="kind" value={link.kind} />
          <LinkFields link={link} kind={link.kind} proLayouts={proLayouts} onImageFile={onImageFile} />
          {onDraftChange ? (
            <p className="hint lf-full">Alterações aplicadas ao exemplo, sem salvar.</p>
          ) : (
            <SubmitButton className="btn btn-primary btn-sm lf-save" pendingLabel="Salvando…">Salvar</SubmitButton>
          )}
        </form>
        <div className="lf-delete">
          <DeleteLinkButton id={link.id} title={link.title} action={deleteAction} posthogEvent={trackEvents ? "link_deleted" : ""} />
        </div>
      </div>
    </details>
  );
}
