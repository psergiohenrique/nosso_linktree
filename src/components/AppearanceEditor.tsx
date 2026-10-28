"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
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
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Salvando…" : "Salvar aparência"}
    </button>
  );
}

export default function AppearanceEditor({ profile, links, branding = true, pro = true, action, slugAction }: Props) {
  const [state, setState] = useState<PageViewProfile>(profile);
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
        profile={{ ...state, avatar_url: avatarUrl, cover_image_url: coverImageUrl }}
        links={links}
        branding={previewBranding}
      />
    </div>
  );
}
