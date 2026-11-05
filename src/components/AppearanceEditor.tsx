"use client";

import { useEffect, useRef, useState } from "react";
import { SOCIAL_NETWORKS, type SocialLinks, type SocialNetwork, type SocialPosition } from "@/lib/types";
import AppearanceFields from "./AppearanceFields";
import { openPaywall } from "./Paywall";
import type { PageViewLink, PageViewProfile } from "./PageView";
import PhonePreview from "./PhonePreview";
import Section from "./Section";
import SubmitButton from "./SubmitButton";
import Toast from "./Toast";

type Props = {
  profile: PageViewProfile;
  links: PageViewLink[];
  branding?: boolean;
  /** Plano Pro: sem selo. No Grátis, desligar o selo mostra a prévia sem ele e o aviso do Pro. */
  pro?: boolean;
  /** Salva perfil, aparência e redes sociais de uma vez. */
  action: (formData: FormData) => Promise<void>;
  slugAction: (formData: FormData) => Promise<void>;
  /** Muda a cada gravação (profiles.updated_at): zera o aviso de alterações não salvas e mostra o aviso de sucesso. */
  version: string;
  message?: { kind: "ok" | "error"; text: string };
  socialPosition: SocialPosition;
  socialLinks: SocialLinks;
};

const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};

function SaveButton() {
  return (
    <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
  );
}

export default function AppearanceEditor({ profile, links, branding = true, pro = true, action, slugAction, version, message, socialPosition, socialLinks }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<PageViewProfile>(profile);
  const [position, setPosition] = useState(socialPosition);
  const [socials, setSocials] = useState(socialLinks);
  const [previewBranding, setPreviewBranding] = useState(branding);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [localCoverImage, setLocalCoverImage] = useState<string | null>(null);
  const [removeCoverImage, setRemoveCoverImage] = useState(false);

  useEffect(() => {
    return () => {
      if (localAvatar) URL.revokeObjectURL(localAvatar);
    };
  }, [localAvatar]);

  useEffect(() => {
    return () => {
      if (localCoverImage) URL.revokeObjectURL(localCoverImage);
    };
  }, [localCoverImage]);

  const avatarUrl = localAvatar ?? (removeAvatar ? null : profile.avatar_url);
  const coverImageUrl = localCoverImage ?? (removeCoverImage ? null : profile.cover_image_url);
  const previewProfile = { ...state, avatar_url: avatarUrl, cover_image_url: coverImageUrl, social_position: position, social_links: socials };

  // Alterações não salvas: compara o que está na tela com o último estado gravado.
  const snapshot = JSON.stringify({ state, position, socials, a: !!localAvatar, ra: removeAvatar, c: !!localCoverImage, rc: removeCoverImage });
  const [baseline, setBaseline] = useState(snapshot);
  const [seenVersion, setSeenVersion] = useState(version);
  if (seenVersion !== version) {
    // Gravou: o que está na tela passa a ser o novo "salvo".
    setSeenVersion(version);
    setBaseline(snapshot);
  }
  const dirty = snapshot !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function discard() {
    setState(profile);
    setPosition(socialPosition);
    setSocials(socialLinks);
    setLocalAvatar(null);
    setRemoveAvatar(false);
    setLocalCoverImage(null);
    setRemoveCoverImage(false);
    form.current?.reset();
  }

  const activeSocials = SOCIAL_NETWORKS.filter((n) => socials[n]?.is_active).length;

  return (
    <div className="dash-grid">
      {message && (
        <Toast key={`${version}:${message.text}`} kind={message.kind}>
          {message.text}
        </Toast>
      )}
      <div className="dash-main enter">
        <div className="dash-head">
          <p className="eyebrow">Aparência</p>
          <h1 className="h2 dash-h1">Sua página, seu jeito</h1>
        </div>
        <form action={slugAction}>
          <Section id="endereco" title="Endereço da página" note={`/${profile.slug}`} collapsible>
            <label className="field-label" htmlFor="slug">Endereço</label>
            <input id="slug" name="slug" className="field" defaultValue={profile.slug} minLength={3} maxLength={30} required autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <p className="hint">Use letras, números ou hífen. Ao alterar, o endereço antigo (e QR codes já impressos) deixa de funcionar.</p>
            <div><SubmitButton className="btn btn-outline btn-sm" pendingLabel="Salvando…">Salvar endereço</SubmitButton></div>
          </Section>
        </form>
        <form ref={form} action={action} className="dash-main" data-posthog-event="appearance_saved">
          <AppearanceFields
            collapsible
            state={state}
            setState={setState}
            avatarUrl={avatarUrl}
            onAvatarFile={(file) => {
              setLocalAvatar(file ? URL.createObjectURL(file) : null);
              if (file) setRemoveAvatar(false);
            }}
            onRemoveAvatar={() => {
              setLocalAvatar(null);
              setRemoveAvatar(true);
            }}
            coverImageUrl={coverImageUrl}
            onCoverImageFile={(file) => {
              setLocalCoverImage(file ? URL.createObjectURL(file) : null);
              if (file) setRemoveCoverImage(false);
            }}
            onRemoveCoverImage={() => {
              setLocalCoverImage(null);
              setRemoveCoverImage(true);
            }}
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
                        onChange={(e) => setSocials((current) => ({ ...current, [network]: { ...current[network], url: e.target.value } }))}
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
                          onChange={(e) => setSocials((current) => ({ ...current, [network]: { ...current[network], is_active: e.target.checked } }))}
                        />
                        <span className="switch-track" />
                      </label>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="field-label" htmlFor="social-position">Onde mostrar</label>
                  <select id="social-position" name="social_position" className="field field-select" value={position} onChange={(e) => setPosition(e.target.value as SocialPosition)}>
                    <option value="below_name">Abaixo do nome e da bio</option>
                    <option value="after_links">Depois dos links</option>
                  </select>
                </div>
              </Section>
            }
          />
          <input type="hidden" name="remove_avatar" value={removeAvatar ? "1" : ""} />
          <input type="hidden" name="remove_cover_image" value={removeCoverImage ? "1" : ""} />

          {/* Convite ao Pro: no Grátis fica sempre aberto (sem lembrar a escolha) e com a etiqueta Pro; no Pro, recolhido. */}
          <Section id={pro ? "selo" : undefined} title="Selo “Feito com Linkbio”" collapsible defaultOpen={!pro} proTag={!pro}>
            {pro ? (
              <p className="hint">Sua página não mostra o selo: incluído no plano Pro.</p>
            ) : (
              <>
                <label className="card-switch">
                  <span className="switch">
                    <input
                      type="checkbox"
                      checked={previewBranding}
                      onChange={(e) => {
                        if (e.target.checked) return setPreviewBranding(true);
                        // Mostra como fica sem o selo e, ao fechar o aviso, volta.
                        setPreviewBranding(false);
                        openPaywall("branding", () => setPreviewBranding(true));
                      }}
                    />
                    <span className="switch-track" />
                  </span>
                  Mostrar o selo no rodapé da página
                </label>
                <p className="hint">No plano Grátis o selo aparece. Desligue para ver sua página sem ele.</p>
              </>
            )}
          </Section>

          {dirty && (
            <div className="save-bar-dock" role="region" aria-label="Alterações não salvas">
              <span>Não salvo</span>
              <span className="dock-actions">
                <button type="button" className="btn btn-sm dock-discard" onClick={discard}>
                  Descartar
                </button>
                <SaveButton />
              </span>
            </div>
          )}
        </form>
      </div>

      <PhonePreview
        profile={previewProfile}
        links={links}
        branding={previewBranding}
        aboveTabBar
      />
    </div>
  );
}
