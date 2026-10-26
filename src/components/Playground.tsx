"use client";

import { useState } from "react";
import Link from "next/link";
import { THEME_PRESETS, WHATSAPP_DEFAULT, type LinkItem } from "@/lib/types";
import AppearanceFields from "./AppearanceFields";
import LinkOptions from "./LinkOptions";
import Logo from "./Logo";
import type { PageViewLink, PageViewProfile } from "./PageView";
import PhonePreview from "./PhonePreview";

type PlayLink = PageViewLink & { active: boolean };

const EXAMPLE_PROFILE: PageViewProfile = {
  ...THEME_PRESETS[2].appearance,
  ...WHATSAPP_DEFAULT,
  slug: "barbearia-do-ze",
  display_name: "Barbearia do Zé",
  bio: "Corte, barba e cerveja gelada. Seg a sáb, 9h às 20h.",
  avatar_url: "/demo/avatar.svg",
  cover_image_url: null,
};

const EXAMPLE_LINKS: PlayLink[] = [
  { id: "1", kind: "whatsapp", title: "Agendar pelo WhatsApp", url: "https://wa.me/5511999999999?text=Quero%20agendar", thumbnail_url: null, layout: "button", size: "lg", active: true },
  { id: "2", kind: "link", title: "Tabela de preços", url: "https://example.com/precos", thumbnail_url: "/demo/precos.svg", layout: "featured", size: "md", active: true },
  { id: "3", kind: "link", title: "Como chegar", url: "https://maps.google.com", thumbnail_url: "/demo/mapa.svg", layout: "tile", size: "md", active: true },
  { id: "4", kind: "link", title: "Instagram", url: "https://instagram.com", thumbnail_url: "/demo/insta.svg", layout: "tile", size: "md", active: true },
  { id: "5", kind: "link", title: "Avaliações no Google", url: "https://google.com", thumbnail_url: null, layout: "button", size: "sm", active: true },
];

const revoke = (url: string | null) => {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
};

/** Playground do /demo: tudo fica só no navegador, nada é salvo. */
export default function Playground() {
  const [tab, setTab] = useState<"links" | "aparencia">("links");
  const [profile, setProfile] = useState<PageViewProfile>(EXAMPLE_PROFILE);
  const [links, setLinks] = useState<PlayLink[]>(EXAMPLE_LINKS);
  const [nextId, setNextId] = useState(100);

  const update = (id: string, change: Partial<PlayLink>) =>
    setLinks((ls) => ls.map((l) => (l.id === id ? { ...l, ...change } : l)));

  const setImage = (link: PlayLink, file: File | null) => {
    revoke(link.thumbnail_url);
    update(link.id, { thumbnail_url: file ? URL.createObjectURL(file) : null });
  };

  const move = (index: number, dir: -1 | 1) =>
    setLinks((ls) => {
      const next = [...ls];
      [next[index], next[index + dir]] = [next[index + dir], next[index]];
      return next;
    });

  const remove = (link: PlayLink) => {
    revoke(link.thumbnail_url);
    setLinks((ls) => ls.filter((l) => l.id !== link.id));
  };

  const add = () => {
    const id = String(nextId);
    setNextId((n) => n + 1);
    setLinks((ls) => [
      ...ls,
      { id, kind: "link", title: "Novo link", url: "https://example.com", thumbnail_url: null, layout: "button", size: "md", active: true },
    ]);
  };

  const reset = () => {
    links.forEach((l) => revoke(l.thumbnail_url));
    revoke(profile.avatar_url);
    revoke(profile.cover_image_url);
    setProfile(EXAMPLE_PROFILE);
    setLinks(EXAMPLE_LINKS);
  };

  return (
    <div className="dash">
      <header className="dash-top">
        <Logo />
        <nav className="dash-tabs" aria-label="Seções do playground">
          {(["links", "aparencia"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={tab === t ? "active" : ""}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {t === "links" ? "Links" : "Aparência"}
            </button>
          ))}
        </nav>
        <div className="dash-top-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={reset}>
            Restaurar exemplo
          </button>
          <Link href="/login?modo=cadastro" className="btn btn-primary btn-sm">
            Criar minha página
          </Link>
        </div>
      </header>

      <p className="notice play-notice">
        <strong>Playground:</strong> teste à vontade, nada é salvo. Imagens enviadas ficam só no seu navegador.
      </p>

      <div className="dash-grid">
        <div className="dash-main">
          {tab === "links" ? (
            <>
              <div className="dash-head dash-head-row">
                <div>
                  <p className="eyebrow">Links</p>
                  <h1 className="h2 dash-h1">Monte seus links</h1>
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={add}>
                  + Adicionar link
                </button>
              </div>

              {links.length === 0 && <p className="dash-empty">Nenhum link. Clique em “Adicionar link”.</p>}

              {links.map((link, i) => (
                <div key={link.id} className={`card ${link.active ? "" : "card-off"}`}>
                  <div className="link-head">
                    <label className="link-thumb-pick" title={link.thumbnail_url ? "Trocar imagem" : "Adicionar imagem"}>
                      {link.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={link.thumbnail_url} alt="" width={48} height={48} className="link-thumb" />
                      ) : (
                        <span className="link-thumb link-thumb-empty" aria-hidden="true">
                          +
                        </span>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        aria-label="Imagem do link"
                        onChange={(e) => setImage(link, e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <input
                      value={link.title}
                      onChange={(e) => update(link.id, { title: e.target.value })}
                      maxLength={80}
                      aria-label="Título"
                      className="field"
                    />
                  </div>

                  <LinkOptions
                    layout={link.layout}
                    size={link.size}
                    namePrefix={`l${link.id}-`}
                    onChange={(change) => update(link.id, change)}
                  />

                  <div className="card-row">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={link.active}
                        onChange={(e) => update(link.id, { active: e.target.checked })}
                      />{" "}
                      Ativo
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={link.kind === "whatsapp"}
                        onChange={(e) => update(link.id, { kind: e.target.checked ? "whatsapp" : ("link" as LinkItem["kind"]) })}
                      />{" "}
                      Botão de WhatsApp
                    </label>
                    {link.thumbnail_url && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setImage(link, null)}>
                        Remover imagem
                      </button>
                    )}
                  </div>

                  <div className="card-actions">
                    <button type="button" className="btn btn-outline btn-sm" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      aria-label="Descer"
                      disabled={i === links.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      ↓
                    </button>
                    <button type="button" className="btn btn-outline btn-sm btn-danger push" onClick={() => remove(link)}>
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="dash-head">
                <p className="eyebrow">Aparência</p>
                <h1 className="h2 dash-h1">Sua página, seu jeito</h1>
              </div>
              <AppearanceFields
                state={profile}
                setState={setProfile}
                avatarUrl={profile.avatar_url}
                onAvatarFile={(file) => {
                  revoke(profile.avatar_url);
                  setProfile((p) => ({ ...p, avatar_url: file ? URL.createObjectURL(file) : null }));
                }}
                onRemoveAvatar={() => {
                  revoke(profile.avatar_url);
                  setProfile((p) => ({ ...p, avatar_url: null }));
                }}
                coverImageUrl={profile.cover_image_url}
                onCoverImageFile={(file) => {
                  revoke(profile.cover_image_url);
                  setProfile((p) => ({ ...p, cover_image_url: file ? URL.createObjectURL(file) : null }));
                }}
                onRemoveCoverImage={() => {
                  revoke(profile.cover_image_url);
                  setProfile((p) => ({ ...p, cover_image_url: null }));
                }}
              />
            </>
          )}
        </div>

        <PhonePreview profile={profile} links={links.filter((l) => l.active)} />
      </div>
    </div>
  );
}
