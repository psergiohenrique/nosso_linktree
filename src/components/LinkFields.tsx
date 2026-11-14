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
export default function LinkFields({ link, kind, proLayouts, onImageFile, readOnly = false }: {
  link?: EditorLink;
  kind: EditorLink["kind"];
  proLayouts: boolean;
  /** Bloco Pix salvo sem o plano Business: dá para ver e excluir, não para gravar. */
  readOnly?: boolean;
  onImageFile?: (file: File | null) => void;
}) {
  const wa = kind === "whatsapp";
  const target = wa && link ? splitWhatsapp(link.url) : null;
  const prefix = link ? `link-${link.id}` : "new";
  if (kind === "pix") {
    return (
      <>
        <div>
          <label className="field-label" htmlFor={`${prefix}-title`}>Título</label>
          <input id={`${prefix}-title`} name="title" defaultValue={link?.title} required maxLength={80} readOnly={readOnly} placeholder="Ex.: Pagar sinal" className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor={`${prefix}-pix-key`}>Chave Pix</label>
          <input id={`${prefix}-pix-key`} name="url" defaultValue={link?.url} required={!readOnly} readOnly={readOnly} maxLength={77} placeholder="CPF, CNPJ, e-mail, +55… ou chave aleatória" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor={`${prefix}-pix-name`}>Nome de quem recebe</label>
          <input id={`${prefix}-pix-name`} name="pix_name" defaultValue={link?.pix?.name} required={!readOnly} readOnly={readOnly} maxLength={40} placeholder="Ex.: Barbearia do Zé" className="field" />
          {!link && <p className="hint">Até 25 letras no código, sem acento. É o nome que o banco mostra.</p>}
        </div>
        <div>
          <label className="field-label" htmlFor={`${prefix}-pix-city`}>Cidade</label>
          <input id={`${prefix}-pix-city`} name="pix_city" defaultValue={link?.pix?.city} required={!readOnly} readOnly={readOnly} maxLength={30} placeholder="Ex.: São Paulo" className="field" />
          {!link && <p className="hint">Até 15 letras. O valor o cliente digita no app do banco.</p>}
        </div>
        {link && <div className="lf-full lf-row"><label className="card-switch"><span className="switch"><input type="checkbox" name="is_active" defaultChecked={link.is_active} disabled={readOnly} /><span className="switch-track" /></span>Ativo na página</label></div>}
      </>
    );
  }
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
