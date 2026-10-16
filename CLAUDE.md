@AGENTS.md

# CLAUDE.md

## What this is

Linkbio (provisional name): a "link in bio" platform for Brazilian small businesses and agencies. Product scope is in `docs/PRD.md`. Built with Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + Supabase (Auth, Postgres, RLS). All user-facing copy is Portuguese (pt-BR).

Follows the same conventions as the sibling site projects (`../site-moraex`, `../site_leticia_moraes`).

## Commands

- `npm run dev` — dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next`)

No test suite configured.

## Architecture

- **`src/app/layout.tsx`** — fonts (Bricolage Grotesque + Manrope via `next/font/google`), global metadata/SEO, JSON-LD (`SoftwareApplication` + `WebSite`), `@vercel/analytics` and `@vercel/speed-insights`. `sitemap.ts`, `robots.ts`, `opengraph-image.tsx` (generated via `next/og`) and `icon.svg` are metadata files.
- **`src/app/page.tsx`** — marketing landing; only composes section components in order: `Nav`, `Hero`, `StatsBar`, `Recursos`, `ComoFunciona`, `Cta`, `Footer`. Each section is a `<section id="...">` matching nav anchors (`#recursos`, `#como-funciona`, `#comecar`). Sections take no props and hold their own copy/data arrays.
- **App routes** — `[slug]` public page (ISR 60 s via `generateStaticParams` returning `[]`; dashboard calls `revalidatePath` on save), `go/[id]` tracked redirect, `api/view` view tracking, `dashboard` (Server Actions in `actions.ts`), `login` (magic link), `auth/callback`, `demo` (static preview, works without Supabase).
- **`src/proxy.ts`** — Next 16 replacement for `middleware.ts`: refreshes the Supabase session and guards `/dashboard`.
- **`src/lib/`** — `supabase/server.ts` (async, cookie-based session client), `supabase/public.ts` (anon client, cache-friendly), `validation.ts` (slug/URL/WhatsApp), `types.ts`, `site.ts` (site URL/name/description from `NEXT_PUBLIC_SITE_URL`).
- **`src/components/RevealWrapper.tsx`** — polymorphic scroll-in `.reveal` wrapper (`IntersectionObserver`), combine with `.d1`–`.d4` delay classes. `Hero`/`StatsBar` skip it so above-the-fold content shows immediately.
- **Client components** — only `Nav`, `RevealWrapper`, `ViewTracker`.
- **Styling** — plain global CSS in `src/app/globals.css`: CSS custom properties on `:root` (`--ink`, `--paper`, `--lime`, `--whats`, …) plus BEM-ish classes (`.wrap`, `.btn-*`, `.h2`, per-section `.hero-*`, `.feat-*`, `.dash-*`, `.bio-*`). Tailwind v4 is imported but not used for styling — don't add Tailwind utilities ad hoc. Responsive rules are hand-written `@media` blocks at the end (900px, 600px). Public page themes are `.bio`, `.bio-dark`, `.bio-sunset` via `--bio-*` variables.
- **Security headers** — set centrally in `next.config.ts`.
- **Database** — `supabase/migrations/0001_init.sql` (tables, RLS, `track_event`, `profile_stats`, `profile_totals`).

## Next 16 notes

`params`, `searchParams`, `cookies()` and `headers()` are async (await them). `next lint` no longer exists. `middleware` is now `proxy`.
