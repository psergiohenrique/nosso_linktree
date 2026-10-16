import Link from "next/link";
import type { LinkItem, Profile } from "@/lib/types";

const THEME_CLASS: Record<Profile["theme"], string> = {
  light: "",
  dark: "bio-dark",
  sunset: "bio-sunset",
  sand: "bio-sand",
};

type Props = {
  profile: Pick<Profile, "display_name" | "bio" | "avatar_url" | "cover_url" | "theme" | "accent" | "slug">;
  links: Pick<LinkItem, "id" | "title" | "url" | "kind">[];
  /** Em modo demo os links vão direto ao destino, sem passar pelo rastreador. */
  tracked?: boolean;
};

export default function PageView({ profile, links, tracked = true }: Props) {
  const themeClass = THEME_CLASS[profile.theme] ?? "";
  const initial = (profile.display_name || profile.slug).charAt(0).toUpperCase();
  // No tema Areia a capa é sempre exibida: imagem do cliente ou padrão de planta.
  const hasCover = Boolean(profile.cover_url) || profile.theme === "sand";

  return (
    <main className={`bio ${themeClass} ${hasCover ? "bio-has-cover" : ""}`}>
      {hasCover && (
        <div
          className="bio-cover"
          style={profile.cover_url ? { backgroundImage: `url("${encodeURI(profile.cover_url)}")` } : undefined}
          role="img"
          aria-label=""
        />
      )}
      <div className="bio-inner">
        <header className="bio-header">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" width={96} height={96} className="bio-avatar" />
          ) : (
            <div className="bio-initial" style={{ backgroundColor: profile.accent }}>
              {initial}
            </div>
          )}
          <h1 className="bio-name">{profile.display_name || `@${profile.slug}`}</h1>
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
                className={`bio-link ${isWhats ? "bio-link-whats" : ""}`}
              >
                {isWhats ? `💬 ${link.title}` : link.title}
              </a>
            );
          })}
        </nav>

        <Link href="/" className="bio-foot">
          Feito com Linkbio
        </Link>
      </div>
    </main>
  );
}
