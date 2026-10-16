import type { LinkItem, Profile } from '@/lib/types';

const THEMES = {
  light: { bg: 'bg-neutral-50', text: 'text-neutral-900', muted: 'text-neutral-600', card: 'bg-white border border-neutral-200' },
  dark: { bg: 'bg-neutral-950', text: 'text-white', muted: 'text-neutral-400', card: 'bg-neutral-900 border border-neutral-800' },
  sunset: { bg: 'bg-gradient-to-b from-orange-100 via-rose-100 to-indigo-200', text: 'text-neutral-900', muted: 'text-neutral-700', card: 'bg-white/80 border border-white' },
} as const;

type Props = {
  profile: Pick<Profile, 'display_name' | 'bio' | 'avatar_url' | 'theme' | 'accent' | 'slug'>;
  links: Pick<LinkItem, 'id' | 'title' | 'url' | 'kind'>[];
  /** Em modo demo os links vão direto ao destino, sem passar pelo rastreador. */
  tracked?: boolean;
};

export default function PageView({ profile, links, tracked = true }: Props) {
  const t = THEMES[profile.theme] ?? THEMES.light;
  const initial = (profile.display_name || profile.slug).charAt(0).toUpperCase();

  return (
    <main className={`min-h-screen px-4 py-10 ${t.bg} ${t.text}`}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-6">
        <header className="flex flex-col items-center gap-3 text-center">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" width={96} height={96} className="h-24 w-24 rounded-full object-cover" />
          ) : (
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white"
              style={{ backgroundColor: profile.accent }}
            >
              {initial}
            </div>
          )}
          <h1 className="text-xl font-semibold">{profile.display_name || `@${profile.slug}`}</h1>
          {profile.bio && <p className={`max-w-xs text-sm ${t.muted}`}>{profile.bio}</p>}
        </header>

        <nav className="flex w-full flex-col gap-3" aria-label="Links">
          {links.map((link) => {
            const isWhats = link.kind === 'whatsapp';
            return (
              <a
                key={link.id}
                href={tracked ? `/go/${link.id}` : link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={`block w-full rounded-xl px-5 py-4 text-center font-medium shadow-sm transition hover:-translate-y-0.5 ${isWhats ? 'text-white' : t.card}`}
                style={isWhats ? { backgroundColor: '#16a34a' } : undefined}
              >
                {isWhats ? `💬 ${link.title}` : link.title}
              </a>
            );
          })}
        </nav>

        <footer className={`pt-4 text-xs ${t.muted}`}>Feito com Linkbio</footer>
      </div>
    </main>
  );
}
