"use client";

import { useState } from "react";
import { FREE_LINK_LIMIT } from "@/lib/billing";
import AddLinkButton from "./AddLinkButton";
import ImageInput from "./ImageInput";
import LinkOptions from "./LinkOptions";
import { PaywallButton, openPaywall } from "./Paywall";

type Kind = "link" | "whatsapp" | "pix";

/**
 * Formulário de link novo quando o Pix está ligado. No Grátis e no Pro, escolher Pix
 * abre o aviso do Business e não envia. Com o recurso desligado, a página usa o formulário antigo.
 */
export default function NewLinkForm({
  action,
  pro,
  business,
  atLimit,
}: {
  action: (formData: FormData) => void;
  pro: boolean;
  business: boolean;
  atLimit: boolean;
}) {
  const [kind, setKind] = useState<Kind>("link");

  function onKind(next: string) {
    if (next === "pix" && !business) {
      openPaywall("pix");
      return;
    }
    if (next === "link" || next === "whatsapp" || next === "pix") setKind(next);
  }

  return (
    <form
      action={action}
      className="card card-new"
      data-posthog-event={kind === "pix" ? "pix_block_added" : "link_created"}
    >
      <h2 className="card-title">Novo link</h2>
      <fieldset className="card-fieldset">
        <div>
          <label className="field-label" htmlFor="new-kind">
            Tipo
          </label>
          <select id="new-kind" name="kind" className="field" value={kind} onChange={(e) => onKind(e.target.value)}>
            <option value="link">Link comum</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="pix">Pix (plano Business)</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="new-title">
            Título
          </label>
          <input id="new-title" name="title" required placeholder="Ex.: Agendar horário" className="field" />
        </div>
        {kind === "pix" ? (
          <>
            <div>
              <label className="field-label" htmlFor="new-pix-key">
                Chave Pix
              </label>
              <input
                id="new-pix-key"
                name="url"
                required
                maxLength={77}
                placeholder="CPF, CNPJ, e-mail, +55… ou chave aleatória"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="field"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="new-pix-name">
                Nome de quem recebe
              </label>
              <input
                id="new-pix-name"
                name="pix_name"
                required
                maxLength={40}
                placeholder="Ex.: Barbearia do Zé"
                className="field"
              />
              <p className="hint">Até 25 letras no código, sem acento. É o nome que o banco mostra.</p>
            </div>
            <div>
              <label className="field-label" htmlFor="new-pix-city">
                Cidade
              </label>
              <input
                id="new-pix-city"
                name="pix_city"
                required
                maxLength={30}
                placeholder="Ex.: São Paulo"
                className="field"
              />
              <p className="hint">Até 15 letras. O valor o cliente digita no app do banco.</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="field-label" htmlFor="new-url">
                Link ou WhatsApp com DDD
              </label>
              <input
                id="new-url"
                name="url"
                required
                placeholder="https://… ou 11 99999-9999"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="field"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="new-message">
                Mensagem inicial <span className="field-optional">(só WhatsApp, opcional)</span>
              </label>
              <input id="new-message" name="message" placeholder="Ex.: Quero agendar" className="field" />
            </div>
            <LinkOptions proLayouts={pro} />
            <label className="file-field">
              <span className="field-label">
                Imagem <span className="field-optional">(opcional; boa para Destaque e Bloco)</span>
              </span>
              <ImageInput name="thumbnail" />
            </label>
          </>
        )}
        {atLimit ? (
          <PaywallButton feature="links" className="btn btn-primary">
            Adicionar
          </PaywallButton>
        ) : (
          <AddLinkButton />
        )}
      </fieldset>
      {atLimit && (
        <p className="hint">
          Você chegou aos {FREE_LINK_LIMIT} links do plano Grátis. Com o Pro, são ilimitados.
        </p>
      )}
    </form>
  );
}
