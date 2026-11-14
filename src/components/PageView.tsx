import type { CSSProperties } from "react";
import Link from "next/link";
import { mediaSrcSet, mediaVariant } from "@/lib/media-variants";
import { type Appearance, type LinkItem, type Profile, type SocialNetwork, type WhatsappAppearance } from "@/lib/types";
import { visibleSocialLinks } from "@/lib/social";
import PixBlock from "./PixBlock";
import ShareButton from "./ShareButton";

export type PageViewProfile = Appearance &
  WhatsappAppearance &
  Pick<Profile, "slug" | "display_name" | "bio" | "show_avatar"> &
  Partial<Pick<Profile, "social_position" | "social_links">> & { avatar_url: string | null; cover_image_url: string | null };

export type PageViewLink = Pick<LinkItem, "id" | "title" | "url" | "kind" | "layout" | "size"> & {
  thumbnail_url: string | null;
  /** BR Code e o SVG do QR, já prontos. Só vêm preenchidos quando o Pix está na página. */
  pixCode?: string | null;
  pixSvg?: string | null;
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

/** Silhuetas das marcas, na cor do texto da página. */
const SOCIAL_ICONS: Record<SocialNetwork, { label: string; path: string }> = {
  instagram: { label: "Instagram", path: "M7 0C3.1 0 0 3.1 0 7v10c0 3.9 3.1 7 7 7h10c3.9 0 7-3.1 7-7V7c0-3.9-3.1-7-7-7H7zm0 2.2h10c2.7 0 4.8 2.1 4.8 4.8v10c0 2.7-2.1 4.8-4.8 4.8H7c-2.7 0-4.8-2.1-4.8-4.8V7c0-2.7 2.1-4.8 4.8-4.8zm10.5 1.6a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM12 5.8a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zm0 2.2a4 4 0 110 8 4 4 0 010-8z" },
  facebook: { label: "Facebook", path: "M24 12a12 12 0 10-13.875 11.855v-8.386H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.313 0 2.686.235 2.686.235v2.953h-1.513c-1.49 0-1.956.925-1.956 1.874V12h3.328l-.532 3.469h-2.796v8.386A12.002 12.002 0 0024 12z" },
  tiktok: { label: "TikTok", path: "M19.589 6.686a4.793 4.793 0 01-3.77-4.246V2h-3.34v13.94a2.805 2.805 0 11-2.417-2.78V9.77a6.15 6.15 0 106.145 6.17V8.843a8.09 8.09 0 004.724 1.51V7.01a4.77 4.77 0 01-1.342-.324z" },
  youtube: { label: "YouTube", path: "M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 00.5 6.2 31 31 0 000 12a31 31 0 00.5 5.8 3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1A31 31 0 0024 12a31 31 0 00-.5-5.8zM9.6 15.6V8.4L15.8 12z" },
  linkedin: { label: "LinkedIn", path: "M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05a3.75 3.75 0 013.38-1.85c3.61 0 4.28 2.37 4.28 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.12 2.06 2.06 0 010 4.12zm1.78 13.02H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" },
  email: { label: "Contato por e-mail", path: "M2 4h20a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V6a2 2 0 012-2zm1.4 2.2L12 12.6l8.6-6.4zM2.2 7.9V17.8h19.6V7.9L12 15.2z" },
  x: { label: "X", path: "M18.9 1.2h3.7l-8.1 9.3L24 22.8h-7.4l-5.8-7.6-6.7 7.6H.4L9 12.9 0 1.2h7.6l5.2 6.9 6.1-6.9zm-1.3 19.4h2L6.5 3.3H4.3l13.3 17.3z" },
};

function SocialNav({ links }: { links: ReturnType<typeof visibleSocialLinks> }) {
  if (!links.length) return null;
  return (
    <nav className="bio-social" aria-label="Redes sociais">
      {links.map(({ network, url }) => (
        <a key={network} href={url} {...(network === "email" ? {} : { target: "_blank", rel: "noopener noreferrer nofollow ugc" })} aria-label={SOCIAL_ICONS[network].label}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={SOCIAL_ICONS[network].path} /></svg>
        </a>
      ))}
    </nav>
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
          <img
            src={mediaVariant(img, 640)}
            srcSet={mediaSrcSet(img, [480, 640, 960, 1280])}
            sizes="(max-width: 680px) 100vw, 680px"
            alt=""
            loading="lazy"
            decoding="async"
            className="bio-featured-img"
          />
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
          <img
            src={mediaVariant(img, 480)}
            srcSet={mediaSrcSet(img, [320, 480, 640, 960])}
            sizes="(max-width: 680px) 50vw, 340px"
            alt=""
            loading="lazy"
            decoding="async"
            className="bio-tile-img"
          />
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
        <img
          src={mediaVariant(img, 96)}
          srcSet={mediaSrcSet(img, [96, 192])}
          sizes="44px"
          alt=""
          width={44}
          height={44}
          loading="lazy"
          decoding="async"
          className="bio-thumb"
        />
      )}
      <span className="bio-link-title">{title}</span>
      {icon}
    </a>
  );
}

export default function PageView({ profile, links, tracked = true, preview = false, branding = true }: Props) {
  const name = profile.display_name.trim();
  const initial = (name || profile.slug).replace("@", "").charAt(0).toUpperCase();
  const socials = visibleSocialLinks(profile.social_links);

  return (
    <main
      className={`bio bio-font-${profile.font} bio-btn-${profile.button_style} ${preview ? "bio-preview" : ""}`}
      style={pageViewStyle(profile)}
    >
      {profile.cover_image_url && (
        <div className="bio-cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaVariant(profile.cover_image_url, 960)}
            srcSet={mediaSrcSet(profile.cover_image_url, [640, 960, 1280])}
            sizes="(max-width: 720px) 100vw, 720px"
            alt=""
            fetchPriority="high"
          />
        </div>
      )}
      {tracked && !preview && <ShareButton title={name || `@${profile.slug}`} />}
      <div className={`bio-inner ${profile.cover_image_url ? "has-cover" : ""}`}>
        <header className="bio-header">
          {profile.show_avatar && (profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaVariant(profile.avatar_url, 192)}
              srcSet={mediaSrcSet(profile.avatar_url, [96, 192, 320])}
              sizes="96px"
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

        {profile.social_position !== "after_links" && <SocialNav links={socials} />}

        <nav className="bio-links" aria-label="Links">
          {groupTiles(links.map((link) => (link.kind === "pix" ? { ...link, layout: "button" as const } : link))).map(
            (group) =>
              Array.isArray(group) ? (
                <div key={group[0].id} className="bio-tiles">
                  {group.map((link) => (
                    <BioLink key={link.id} link={link} tracked={tracked} />
                  ))}
                </div>
              ) : group.kind === "pix" ? (
                group.pixCode ? (
                  <PixBlock key={group.id} title={group.title} code={group.pixCode} svg={group.pixSvg ?? null} />
                ) : null
              ) : (
                <BioLink key={group.id} link={group} tracked={tracked} />
              ),
          )}
        </nav>

        {profile.social_position === "after_links" && <SocialNav links={socials} />}

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
