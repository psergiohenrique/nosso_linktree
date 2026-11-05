"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { EditorLink, LinkEditorActions } from "@/lib/editor";
import { EXAMPLE_LINKS, EXAMPLE_PROFILE, playgroundLinkDraft, readPlaygroundLink, reorderPlaygroundLinks } from "@/lib/playground";
import AppearanceSections, { AppearanceHeading } from "./AppearanceSections";
import LinksEditor from "./LinksEditor";
import EditorShell, { EditorGrid } from "./EditorShell";
import EditorTabs, { EDITOR_TABS } from "./EditorTabs";
import type { PageViewProfile } from "./PageView";
import PhonePreview from "./PhonePreview";

const TABS = EDITOR_TABS.filter((t) => t.id === "links" || t.id === "aparencia");

/** Adaptador em memória: a interface vem dos mesmos componentes usados no painel. */
export default function Playground() {
  const [tab, setTab] = useState<"links" | "aparencia">("links");
  const [profile, setProfile] = useState<PageViewProfile>(EXAMPLE_PROFILE);
  const [links, setLinks] = useState<EditorLink[]>(EXAMPLE_LINKS);
  const [generation, setGeneration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(100);
  const objectUrls = useRef(new Map<string, string>());

  useEffect(() => {
    const owned = objectUrls.current;
    return () => { owned.forEach((url) => URL.revokeObjectURL(url)); owned.clear(); };
  }, []);

  function imageUrl(key: string, file: File | null) {
    const previous = objectUrls.current.get(key);
    if (previous) URL.revokeObjectURL(previous);
    objectUrls.current.delete(key);
    const url = file ? URL.createObjectURL(file) : null;
    if (url) objectUrls.current.set(key, url);
    return url;
  }

  function setLinkImage(id: string, file: File | null) {
    const url = imageUrl(`link:${id}`, file);
    setLinks((current) => current.map((link) => link.id === id ? { ...link, thumbnail_url: url } : link));
  }

  function edit(data: FormData) {
    const id = String(data.get("id"));
    if (data.get("remove_thumbnail") === "on") imageUrl(`link:${id}`, null);
    setLinks((current) => current.map((link) => link.id === id ? playgroundLinkDraft(link, data) : link));
  }

  function setProfileImage(field: "avatar_url" | "cover_image_url", file: File | null) {
    const url = imageUrl(field, file);
    setProfile((current) => ({ ...current, [field]: url }));
  }

  const actions: LinkEditorActions = {
    create: async (data) => {
      const fields = readPlaygroundLink(data);
      if (!fields.title.trim() || !fields.url) {
        setError(!fields.title.trim() ? "Dê um título ao link." : fields.kind === "whatsapp" ? "Número de WhatsApp inválido." : "URL inválida.");
        return;
      }
      const id = String(nextId.current++);
      const file = data.get("thumbnail");
      const thumbnail_url = imageUrl(`link:${id}`, file instanceof File && file.size > 0 ? file : null);
      const link: EditorLink = { ...fields, url: fields.url, id, is_active: true, thumbnail_url };
      setLinks((current) => [...current, link]);
      setError(null);
    },
    update: async (data) => edit(data),
    remove: async (data) => {
      const id = String(data.get("id"));
      imageUrl(`link:${id}`, null);
      setLinks((current) => current.filter((link) => link.id !== id));
    },
    reorder: async (ids) => setLinks((current) => reorderPlaygroundLinks(current, ids)),
  };

  function reset() {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
    setProfile(EXAMPLE_PROFILE);
    setLinks(EXAMPLE_LINKS);
    setError(null);
    nextId.current = 100;
    // Recria também os campos não controlados dos formulários compartilhados.
    setGeneration((n) => n + 1);
  }

  return (
    <EditorShell
      navigation={<EditorTabs tabs={TABS} active={tab} label="Seções do playground" onSelect={(id) => { if (id === "links" || id === "aparencia") setTab(id); }} />}
      actions={<>
        <button type="button" className="btn btn-outline btn-sm hdr-btn" onClick={reset} aria-label="Restaurar exemplo">
          <span className="hdr-label">Restaurar exemplo</span>
          <svg className="hdr-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></svg>
        </button>
        <Link href="/login?modo=cadastro" className="btn btn-primary btn-sm hdr-btn" aria-label="Criar minha página">
          <span className="hdr-label">Criar minha página</span>
          <svg className="hdr-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </Link>
      </>}
    >
      <p className="notice play-notice"><strong>Playground:</strong> teste à vontade, nada é salvo. Imagens enviadas ficam só no seu navegador.</p>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <EditorGrid key={generation} preview={<PhonePreview profile={profile} links={links.filter((link) => link.is_active)} branding={false} />}>
        {tab === "links" ? (
          <LinksEditor links={links} access={{ proLayouts: true, atLimit: false, limit: 0 }} actions={actions} onDraftChange={edit} onImageFile={setLinkImage} />
        ) : <>
          <AppearanceHeading />
          <AppearanceSections pro branding={false} onBrandingChange={() => {}} state={profile} setState={setProfile}
            avatarUrl={profile.avatar_url} onAvatarFile={(file) => setProfileImage("avatar_url", file)} onRemoveAvatar={() => setProfileImage("avatar_url", null)}
            coverImageUrl={profile.cover_image_url} onCoverImageFile={(file) => setProfileImage("cover_image_url", file)} onRemoveCoverImage={() => setProfileImage("cover_image_url", null)} />
        </>}
      </EditorGrid>
    </EditorShell>
  );
}
