import type { CSSProperties } from "react";
import Link from "next/link";
import { mediaUrl, type Appearance, type LinkItem, type Profile } from "@/lib/types";

export type PageViewProfile = Appearance & Pick<Profile, "slug" | "display_name" | "bio"> & { avatar_url: string | null };

export type PageViewLink = Pick<LinkItem, "id" | "title" | "url" | "kind"> & { thumbnail_url: string | null };

type Props = {
  profile: PageViewProfile;
  links: PageViewLink[];
  /** Em modo demo/prévia os links vão direto ao destino, sem passar pelo rastreador. */
  tracked?: boolean;
  /** Prévia do painel: renderiza dentro do celular, sem altura de tela cheia. */
  preview?: boolean;
};

export function pageViewStyle(a: Appearance): CSSProperties {
  return {
    "--bio-bg": a.bg_type === "gradient" ? `linear-gradient(180deg, ${a.bg_color} 0%, ${a.bg_color2} 100%)` : a.bg_color,
    "--bio-text": a.text_color,
    "--btn-bg": a.button_color,
    "--btn-text": a.button_text_color,
  } as CSSProperties;
}

export default function PageView({ profile, links, tracked = true, preview = false }: Props) {
  const name = profile.display_name || `@${profile.slug}`;
  const initial = name.replace("@", "").charAt(0).toUpperCase();

  return (
    <main
      className={`bio bio-font-${profile.font} bio-btn-${profile.button_style} ${preview ? "bio-preview" : ""}`}
      style={pageViewStyle(profile)}
    >
      <div className="bio-inner">
        <header className="bio-header">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" width={96} height={96} className="bio-avatar" />
          ) : (
            <div className="bio-initial">{initial}</div>
          )}
          <h1 className="bio-name">{name}</h1>
          {profile.bio && <p className="bio-text">{profile.bio}</p>}
        </header>

        <nav className="bio-links" aria-label="Links">
          {links.map((link) => {
            const isWhats = link.kind === "whatsapp";
            return (
              <a
                key={link.id}
                href={tracked ? `/go/${link.id}` : link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={`bio-link ${isWhats ? "bio-link-whats" : ""} ${link.thumbnail_url ? "has-thumb" : ""}`}
              >
                {link.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={link.thumbnail_url} alt="" width={44} height={44} className="bio-thumb" />
                )}
                <span className="bio-link-title">{isWhats && !link.thumbnail_url ? `💬 ${link.title}` : link.title}</span>
              </a>
            );
          })}
        </nav>

        {preview ? (
          <span className="bio-foot">Feito com Linkbio</span>
        ) : (
          <Link href="/" className="bio-foot">
            Feito com Linkbio
          </Link>
        )}
      </div>
    </main>
  );
}

/** Converte perfil e links do banco nas props da página (ids de mídia viram URLs). */
export function toPageViewProps(profile: Profile, links: LinkItem[]) {
  return {
    profile: { ...profile, avatar_url: profile.avatar_id ? mediaUrl(profile.avatar_id) : null },
    links: links.map((l) => ({ ...l, thumbnail_url: l.thumbnail_id ? mediaUrl(l.thumbnail_id) : null })),
  };
}
