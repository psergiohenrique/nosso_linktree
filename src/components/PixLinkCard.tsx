import DeleteLinkButton from "./DeleteLinkButton";
import { PaywallButton } from "./Paywall";
import type { LinkItem } from "@/lib/types";
import { deleteLink, moveLink, updateLink } from "@/app/dashboard/actions";

/** Edição de um bloco Pix já salvo. Sem o Business, dá para ver e excluir; gravar de novo, não. */
export default function PixLinkCard({
  link,
  index,
  total,
  canEdit,
  pixFlag,
}: {
  link: LinkItem;
  index: number;
  total: number;
  canEdit: boolean;
  pixFlag: boolean;
}) {
  const name = link.config?.merchantName ?? "";
  const city = link.config?.merchantCity ?? "";
  const base = `pix-${link.id}`;

  const fields = (
    <>
      <div className="link-head">
        <div className="link-thumb link-thumb-empty" aria-hidden="true">
          ◇
        </div>
        <input name="title" defaultValue={link.title} required aria-label="Título" className="field" readOnly={!canEdit} />
      </div>
      <label className="field-label" htmlFor={`${base}-key`}>
        Chave Pix
      </label>
      <input
        id={`${base}-key`}
        name="url"
        defaultValue={link.url}
        required={canEdit}
        readOnly={!canEdit}
        maxLength={77}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Chave Pix"
        className="field"
      />
      <label className="field-label" htmlFor={`${base}-name`}>
        Nome de quem recebe
      </label>
      <input
        id={`${base}-name`}
        name="pix_name"
        defaultValue={name}
        required={canEdit}
        readOnly={!canEdit}
        maxLength={40}
        aria-label="Nome de quem recebe"
        className="field"
      />
      <label className="field-label" htmlFor={`${base}-city`}>
        Cidade
      </label>
      <input
        id={`${base}-city`}
        name="pix_city"
        defaultValue={city}
        required={canEdit}
        readOnly={!canEdit}
        maxLength={30}
        aria-label="Cidade"
        className="field"
      />
      <div className="card-row">
        <label className="check">
          <input type="checkbox" name="is_active" defaultChecked={link.is_active} disabled={!canEdit} /> Ativo
        </label>
        <span className="link-kind">Pix</span>
        {canEdit ? (
          <button className="btn btn-primary btn-sm">Salvar</button>
        ) : pixFlag ? (
          <PaywallButton feature="pix">Salvar</PaywallButton>
        ) : null}
      </div>
      {!canEdit && (
        <p className="hint">
          {pixFlag
            ? "O bloco Pix faz parte do plano Business. Ele continua salvo, mas não aparece na página."
            : "O bloco Pix está desligado. Ele continua salvo, mas não aparece na página."}
        </p>
      )}
    </>
  );

  return (
    <div className={`card ${link.is_active ? "" : "card-off"}`}>
      {canEdit ? (
        <form action={updateLink} className="card-form" data-posthog-event="link_updated">
          <input type="hidden" name="id" value={link.id} />
          <input type="hidden" name="kind" value="pix" />
          {fields}
        </form>
      ) : (
        <div className="card-form">{fields}</div>
      )}
      <div className="card-actions">
        <form action={moveLink}>
          <input type="hidden" name="id" value={link.id} />
          <input type="hidden" name="dir" value="up" />
          <button className="btn btn-outline btn-sm" aria-label="Subir" disabled={index === 0}>
            ↑
          </button>
        </form>
        <form action={moveLink}>
          <input type="hidden" name="id" value={link.id} />
          <input type="hidden" name="dir" value="down" />
          <button className="btn btn-outline btn-sm" aria-label="Descer" disabled={index === total - 1}>
            ↓
          </button>
        </form>
        <DeleteLinkButton id={link.id} title={link.title} action={deleteLink} />
      </div>
    </div>
  );
}
