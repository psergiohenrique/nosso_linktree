"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { SOCIAL_NETWORKS, type SocialLinks, type SocialNetwork, type SocialPosition } from "@/lib/types";
import AppearanceFields from "./AppearanceFields";
import { openPaywall } from "./Paywall";
import type { PageViewLink, PageViewProfile } from "./PageView";
import PhonePreview from "./PhonePreview";

type Props = {
  profile: PageViewProfile;
  links: PageViewLink[];
  branding?: boolean;
  /** Plano Pro: sem selo. No Grátis, desligar o selo mostra a prévia sem ele e o aviso do Pro. */
  pro?: boolean;
  action: (formData: FormData) => Promise<void>;
  slugAction: (formData: FormData) => Promise<void>;
  socialAction: (formData: FormData) => Promise<void>;
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
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Salvando…" : "Salvar aparência"}
    </button>
  );
}

export default function AppearanceEditor({ profile, links, branding = true, pro = true, action, slugAction, socialAction, socialPosition, socialLinks }: Props) {
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

  return (
    <div className="dash-grid">
      <div className="dash-main">
        <div className="dash-head">
          <p className="eyebrow">Aparência</p>
          <h1 className="h2 dash-h1">Sua página, seu jeito</h1>
        </div>
        <form action={slugAction} className="card">
          <h2 className="card-title">Endereço da página</h2>
          <label htmlFor="slug">Endereço</label>
          <input id="slug" name="slug" className="field" defaultValue={profile.slug} minLength={3} maxLength={30} required />
          <p className="hint">Use letras, números ou hífen. Ao alterar, o endereço antigo deixa de funcionar.</p>
          <div><button className="btn btn-outline btn-sm" type="submit">Salvar endereço</button></div>
        </form>
        <form action={socialAction} className="card">
          <h2 className="card-title">Redes sociais</h2>
          <p className="hint">Adicione os endereços e ative as redes que deseja mostrar. URLs sem protocolo são aceitas.</p>
          <div>
            <label className="field-label" htmlFor="social-position">Posição das redes sociais</label>
            <select id="social-position" name="social_position" className="field" value={position} onChange={(e) => setPosition(e.target.value as SocialPosition)}>
              <option value="below_name">Abaixo do nome e da bio</option>
              <option value="after_links">Depois dos links</option>
            </select>
          </div>
          {SOCIAL_NETWORKS.map((network) => (
            <div key={network}>
              <label className="field-label" htmlFor={`social-${network}`}>{SOCIAL_LABELS[network]}</label>
              <input
                id={`social-${network}`}
                name={`${network}_url`}
                className="field"
                value={socials[network]?.url ?? ""}
                onChange={(e) => setSocials((current) => ({ ...current, [network]: { ...current[network], url: e.target.value } }))}
                placeholder="https://…"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <label className="check">
                <input
                  type="checkbox"
                  name={`${network}_is_active`}
                  value="1"
                  checked={socials[network]?.is_active ?? false}
                  onChange={(e) => setSocials((current) => ({ ...current, [network]: { ...current[network], is_active: e.target.checked } }))}
                />
                Mostrar {SOCIAL_LABELS[network]}
              </label>
            </div>
          ))}
          <div><button className="btn btn-primary btn-sm">Salvar redes sociais</button></div>
        </form>
        <form action={action} className="dash-main" data-posthog-event="appearance_saved">

        <AppearanceFields
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
        />
        <input type="hidden" name="remove_avatar" value={removeAvatar ? "1" : ""} />
        <input type="hidden" name="remove_cover_image" value={removeCoverImage ? "1" : ""} />

        <section className="card">
          <h2 className="card-title">Selo “Feito com Linkbio”</h2>
          {pro ? (
            <p className="hint">Sua página não mostra o selo: incluído no plano Pro.</p>
          ) : (
            <>
              <label className="check">
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
                Mostrar o selo no rodapé da página
              </label>
              <p className="hint">No plano Grátis o selo aparece. Desmarque para ver sua página sem ele.</p>
            </>
          )}
        </section>

        <div className="save-bar">
          <SaveButton />
        </div>
        </form>
      </div>

      <PhonePreview
        profile={previewProfile}
        links={links}
        branding={previewBranding}
      />
    </div>
  );
}
