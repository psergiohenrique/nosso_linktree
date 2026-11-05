"use client";

import type { ComponentProps } from "react";
import { SOCIAL_NETWORKS, type SocialNetwork, type SocialPosition } from "@/lib/types";
import { EMPTY_SOCIAL_LINKS } from "@/lib/editor";
import AppearanceFields from "./AppearanceFields";
import { openPaywall } from "./Paywall";
import Section from "./Section";

const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};

type Props = Omit<ComponentProps<typeof AppearanceFields>, "afterProfile"> & {
  pro: boolean;
  branding: boolean;
  onBrandingChange: (branding: boolean) => void;
};

export function AppearanceHeading() {
  return (
    <div className="dash-head">
      <p className="eyebrow">Aparência</p>
      <h1 className="h2 dash-h1">Sua página, seu jeito</h1>
    </div>
  );
}

/** Toda a composição de Aparência vive aqui: painel e demo não escolhem seções separadamente. */
export default function AppearanceSections({ pro, branding, onBrandingChange, ...fields }: Props) {
  const { state, setState } = fields;
  const socials = state.social_links ?? EMPTY_SOCIAL_LINKS;
  const activeSocials = SOCIAL_NETWORKS.filter((n) => socials[n]?.is_active).length;
  return (
    <>
      <AppearanceFields
        {...fields}
        afterProfile={
          <Section id="redes" title="Redes sociais" note={activeSocials ? `${activeSocials} ${activeSocials === 1 ? "ativa" : "ativas"}` : undefined} collapsible>
            <p className="hint">Cole o endereço e ligue as que quer mostrar. URLs sem https:// também funcionam.</p>
            <div className="social-list">
              {SOCIAL_NETWORKS.map((network) => (
                <div key={network} className="social-row">
                  <label className="field-label" htmlFor={`social-${network}`}>{SOCIAL_LABELS[network]}</label>
                  <input
                    id={`social-${network}`}
                    name={`${network}_url`}
                    className="field"
                    value={socials[network]?.url ?? ""}
                    onChange={(e) => setState((current) => ({ ...current, social_links: {
                      ...(current.social_links ?? EMPTY_SOCIAL_LINKS),
                      [network]: { ...(current.social_links ?? EMPTY_SOCIAL_LINKS)[network], url: e.target.value },
                    } }))}
                    placeholder="https://…"
                    inputMode="url"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <label className="switch" title={`Mostrar ${SOCIAL_LABELS[network]}`}>
                    <input
                      type="checkbox"
                      name={`${network}_is_active`}
                      value="1"
                      aria-label={`Mostrar ${SOCIAL_LABELS[network]}`}
                      checked={socials[network]?.is_active ?? false}
                      onChange={(e) => setState((current) => ({ ...current, social_links: {
                        ...(current.social_links ?? EMPTY_SOCIAL_LINKS),
                        [network]: { ...(current.social_links ?? EMPTY_SOCIAL_LINKS)[network], is_active: e.target.checked },
                      } }))}
                    />
                    <span className="switch-track" />
                  </label>
                </div>
              ))}
            </div>
            <div>
              <label className="field-label" htmlFor="social-position">Onde mostrar</label>
              <select id="social-position" name="social_position" className="field field-select" value={state.social_position ?? "below_name"} onChange={(e) => setState((current) => ({ ...current, social_position: e.target.value as SocialPosition }))}>
                <option value="below_name">Abaixo do nome e da bio</option>
                <option value="after_links">Depois dos links</option>
              </select>
            </div>
          </Section>
        }
      />
      {/* No Grátis, a seção sempre aberta convida ao Pro; no Pro, começa recolhida. */}
      <Section id={pro ? "selo" : undefined} title="Selo “Feito com Linkbio”" collapsible defaultOpen={!pro} proTag={!pro}>
        {pro ? <p className="hint">Sua página não mostra o selo: incluído no plano Pro.</p> : (
          <>
            <label className="card-switch">
              <span className="switch">
                <input type="checkbox" checked={branding} onChange={(e) => {
                  if (e.target.checked) return onBrandingChange(true);
                  onBrandingChange(false);
                  openPaywall("branding", () => onBrandingChange(true));
                }} />
                <span className="switch-track" />
              </span>
              Mostrar o selo no rodapé da página
            </label>
            <p className="hint">No plano Grátis o selo aparece. Desligue para ver sua página sem ele.</p>
          </>
        )}
      </Section>
    </>
  );
}
