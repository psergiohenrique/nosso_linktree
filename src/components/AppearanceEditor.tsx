"use client";

import { useEffect, useRef, useState } from "react";
import type { SocialLinks, SocialPosition } from "@/lib/types";
import AppearanceSections, { AppearanceHeading } from "./AppearanceSections";
import { EditorGrid } from "./EditorShell";
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

function SaveButton() {
  return (
    <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
  );
}

export default function AppearanceEditor({ profile, links, branding = true, pro = true, action, slugAction, version, message, socialPosition, socialLinks }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<PageViewProfile>({ ...profile, social_position: socialPosition, social_links: socialLinks });
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
  const previewProfile = { ...state, avatar_url: avatarUrl, cover_image_url: coverImageUrl };

  // Alterações não salvas: compara o que está na tela com o último estado gravado.
  const snapshot = JSON.stringify({ state, a: !!localAvatar, ra: removeAvatar, c: !!localCoverImage, rc: removeCoverImage });
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
    setState({ ...profile, social_position: socialPosition, social_links: socialLinks });
    setLocalAvatar(null);
    setRemoveAvatar(false);
    setLocalCoverImage(null);
    setRemoveCoverImage(false);
    form.current?.reset();
  }

  return (
    <EditorGrid preview={<PhonePreview profile={previewProfile} links={links} branding={previewBranding} />}>
      {message && (
        <Toast key={`${version}:${message.text}`} kind={message.kind}>
          {message.text}
        </Toast>
      )}
      <AppearanceHeading />
      <form action={slugAction}>
        <Section id="endereco" title="Endereço da página" note={`/${profile.slug}`} collapsible>
          <label className="field-label" htmlFor="slug">Endereço</label>
          <input id="slug" name="slug" className="field" defaultValue={profile.slug} minLength={3} maxLength={30} required autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          <p className="hint">Use letras, números ou hífen. Ao alterar, o endereço antigo (e QR codes já impressos) deixa de funcionar.</p>
          <div><SubmitButton className="btn btn-outline btn-sm" pendingLabel="Salvando…">Salvar endereço</SubmitButton></div>
        </Section>
      </form>
      <form ref={form} action={action} className="dash-main" data-posthog-event="appearance_saved">
        <AppearanceSections
          pro={pro}
          branding={previewBranding}
          onBrandingChange={setPreviewBranding}
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
    </EditorGrid>
  );
}
