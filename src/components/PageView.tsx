import type { CSSProperties } from "react";
import Link from "next/link";
import { applyPlanToLinks } from "@/lib/billing";
import { mediaUrl, type Appearance, type LinkItem, type Profile, type WhatsappAppearance } from "@/lib/types";

export type PageViewProfile = Appearance &
  WhatsappAppearance &
  Pick<Profile, "slug" | "display_name" | "bio" | "show_avatar"> & { avatar_url: string | null; cover_image_url: string | null };

export type PageViewLink = Pick<LinkItem, "id" | "title" | "url" | "kind" | "layout" | "size"> & {
  thumbnail_url: string | null;
};

type Props = {
  profile: PageViewProfile;
  links: PageViewLink[];
  /** Em modo demo/prévia os links vão direto ao destino, sem passar pelo rastreador. */
  tracked?: boolean;
  /** Prévia do painel: renderiza dentro do celular, sem altura de tela cheia. */
  preview?: boolean;
  /** Selo "Feito com Linkbio" (o plano Pro tira). */
  branding?: boolean;
};

/** Cores do botão de WhatsApp; sem estilo (temas prontos) ou "green", fica o verde padrão do CSS. */
function whatsappVars(a: Appearance & Partial<WhatsappAppearance>): Record<string, string> {
  if (a.whatsapp_style === "theme") return { "--whats-bg": a.button_color, "--whats-text": a.button_text_color };
  if (a.whatsapp_style === "custom" && a.whatsapp_color && a.whatsapp_text_color)
    return { "--whats-bg": a.whatsapp_color, "--whats-text": a.whatsapp_text_color };
  return {};
}

export function pageViewStyle(a: Appearance & Partial<WhatsappAppearance>): CSSProperties {
  return {
    "--bio-bg": a.bg_type === "gradient" ? `linear-gradient(180deg, ${a.bg_color} 0%, ${a.bg_color2} 100%)` : a.bg_color,
    "--bio-text": a.text_color,
    "--btn-bg": a.button_color,
    "--btn-text": a.button_text_color,
    "--initial-bg": a.initial_bg_color ?? a.button_color,
    "--initial-text": a.initial_text_color ?? a.button_text_color,
    ...whatsappVars(a),
  } as CSSProperties;
}

/** Logo do WhatsApp (Simple Icons, CC0), na cor do texto do botão. */
export function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

/** Blocos (tile) seguidos ficam juntos numa grade de 2 colunas. */
function groupTiles(links: PageViewLink[]) {
  const out: (PageViewLink | PageViewLink[])[] = [];
  for (const link of links) {
    const last = out[out.length - 1];
    if (link.layout === "tile" && Array.isArray(last)) last.push(link);
    else out.push(link.layout === "tile" ? [link] : link);
  }
  return out;
}

function BioLink({ link, tracked }: { link: PageViewLink; tracked: boolean }) {
  const isWhats = link.kind === "whatsapp";
  const img = link.thumbnail_url;
  const title = link.title;
  const common = {
    href: tracked ? `/go/${link.id}` : link.url,
    target: "_blank",
    // ugc: links de usuário. Passam por /go (bloqueado no robots), então não transferem relevância.
    rel: "noopener noreferrer nofollow ugc",
  };
  const tone = isWhats ? "bio-link-whats" : "";
  const icon = isWhats && <WhatsappIcon className="bio-whats-icon" />;

  if (link.layout === "featured") {
    return (
      <a {...common} className={`bio-link bio-featured bio-size-${link.size} ${tone}`}>
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" loading="lazy" decoding="async" className="bio-featured-img" />
        )}
        <span className="bio-featured-title">
          {title}
          {icon}
        </span>
      </a>
    );
  }

  if (link.layout === "tile") {
    return (
      <a {...common} className={`bio-link bio-tile bio-size-${link.size} ${tone} ${img ? "has-img" : ""}`}>
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" loading="lazy" decoding="async" className="bio-tile-img" />
        )}
        <span className="bio-tile-title">{title}</span>
        {icon}
      </a>
    );
  }

  return (
    <a {...common} className={`bio-link bio-size-${link.size} ${tone} ${img ? "has-thumb" : ""}`}>
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" width={44} height={44} loading="lazy" decoding="async" className="bio-thumb" />
      )}
      <span className="bio-link-title">{title}</span>
      {icon}
    </a>
  );
}

export default function PageView({ profile, links, tracked = true, preview = false, branding = true }: Props) {
  const name = profile.display_name.trim();
  const initial = (name || profile.slug).replace("@", "").charAt(0).toUpperCase();

  return (
    <main
      className={`bio bio-font-${profile.font} bio-btn-${profile.button_style} ${preview ? "bio-preview" : ""}`}
      style={pageViewStyle(profile)}
    >
      {profile.cover_image_url && (
        <div className="bio-cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.cover_image_url} alt="" fetchPriority="high" />
        </div>
      )}
      <div className={`bio-inner ${profile.cover_image_url ? "has-cover" : ""}`}>
        <header className="bio-header">
          {profile.show_avatar && (profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={`Foto de ${name || `@${profile.slug}`}`}
              width={96}
              height={96}
              fetchPriority={profile.cover_image_url ? "auto" : "high"}
              className="bio-avatar"
            />
          ) : (
            <div className="bio-initial">{initial}</div>
          ))}
          {name && <h1 className="bio-name">{name}</h1>}
          {profile.bio && <p className="bio-text">{profile.bio}</p>}
        </header>

        <nav className="bio-links" aria-label="Links">
          {groupTiles(links).map((group) =>
            Array.isArray(group) ? (
              <div key={group[0].id} className="bio-tiles">
                {group.map((link) => (
                  <BioLink key={link.id} link={link} tracked={tracked} />
                ))}
              </div>
            ) : (
              <BioLink key={group.id} link={group} tracked={tracked} />
            ),
          )}
        </nav>

        {!branding ? null : preview ? (
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

/**
 * Converte perfil e links do banco nas props da página (ids de mídia viram URLs) e aplica o plano:
 * no Grátis, só os primeiros links, todos como botão, e com o selo.
 */
export function toPageViewProps(profile: Profile, links: LinkItem[], pro = true) {
  return {
    profile: {
      ...profile,
      avatar_url: profile.avatar_id ? mediaUrl(profile.avatar_id) : null,
      cover_image_url: profile.cover_image_id ? mediaUrl(profile.cover_image_id) : null,
    },
    links: applyPlanToLinks(links, pro).map((l) => ({
      ...l,
      thumbnail_url: l.thumbnail_id ? mediaUrl(l.thumbnail_id) : null,
    })),
    branding: !pro,
  };
}
