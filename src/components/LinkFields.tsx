"use client";

import type { EditorLink } from "@/lib/editor";
import ImageField from "./ImageField";
import LinkOptions from "./LinkOptions";

export function splitWhatsapp(url: string) {
  try {
    const u = new URL(url);
    return { phone: u.pathname.replace("/", ""), message: u.searchParams.get("text") ?? "" };
  } catch {
    return { phone: "", message: "" };
  }
}

/** Campos únicos para criação/edição de links no painel e no demo. */
export default function LinkFields({ link, kind, proLayouts, onImageFile }: {
  link?: EditorLink;
  kind: EditorLink["kind"];
  proLayouts: boolean;
  onImageFile?: (file: File | null) => void;
}) {
  const wa = kind === "whatsapp";
  const target = wa && link ? splitWhatsapp(link.url) : null;
  const prefix = link ? `link-${link.id}` : "new";
  return (
    <>
      <div>
        <label className="field-label" htmlFor={`${prefix}-title`}>Título</label>
        <input id={`${prefix}-title`} name="title" defaultValue={link?.title} required maxLength={80} placeholder={wa ? "Ex.: Falar no WhatsApp" : "Ex.: Agendar horário"} className="field" />
      </div>
      <div>
        <label className="field-label" htmlFor={`${prefix}-url`}>{wa ? "WhatsApp com DDD" : "Link"}</label>
        <input id={`${prefix}-url`} name="url" defaultValue={target?.phone ?? link?.url} required placeholder={wa ? "11 99999-9999" : "https://…"} inputMode={wa ? "tel" : "url"} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="field" />
      </div>
      {wa && <div className="lf-full">
        <label className="field-label" htmlFor={`${prefix}-message`}>Mensagem inicial <span className="field-optional">(opcional)</span></label>
        <input id={`${prefix}-message`} name="message" defaultValue={target?.message} placeholder="Ex.: Quero agendar" className="field" />
      </div>}
      <div className="lf-full"><LinkOptions layout={link?.layout} size={link?.size} proLayouts={proLayouts} /></div>
      <div className="lf-full lf-row">
        <span className="lf-image">
          {!link && <span className="field-label">Imagem <span className="field-optional">(opcional; boa para Destaque e Bloco)</span></span>}
          <ImageField name="thumbnail" hasImage={!!link?.thumbnail_url} onFile={onImageFile} />
          {link?.thumbnail_url && <label className="check"><input type="checkbox" name="remove_thumbnail" /> Remover imagem</label>}
        </span>
        {link && <label className="card-switch"><span className="switch"><input type="checkbox" name="is_active" defaultChecked={link.is_active} /><span className="switch-track" /></span>Ativo na página</label>}
      </div>
    </>
  );
}
