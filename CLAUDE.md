@AGENTS.md

# CLAUDE.md

## What this is

Linkbio (provisional name): a "link in bio" platform for Brazilian small businesses and agencies. Product scope is in `docs/PRD.md`. Built with Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + PostgreSQL (via `pg`, raw SQL). The backend lives in this repo (`src/server/`); locally Postgres runs in Docker. All user-facing copy is Portuguese (pt-BR).

Follows the same conventions as the sibling site projects (`../site-moraex`, `../site_leticia_moraes`).

## Commands

- `npm run dev` — dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next`)
- `npm run db:up` — start local Postgres (docker-compose, port 5435)
- `npm run db:migrate` — apply pending `db/migrations/*.sql` (tracked in `schema_migrations`)
- `npm run db:seed` — dev-only demo account + page + 30 days of events (credentials at the top of `scripts/seed.mjs`)

Env vars live in `.env.local` (see `.env.example`): `DATABASE_URL`, `APP_SECRET`, `NEXT_PUBLIC_SITE_URL`.

No test suite configured.

## Architecture

- **`src/app/layout.tsx`** — fonts (Bricolage Grotesque + Manrope via `next/font/google`), global metadata/SEO, JSON-LD (`SoftwareApplication` + `WebSite`), `@vercel/analytics` and `@vercel/speed-insights`. `sitemap.ts`, `robots.ts`, `opengraph-image.tsx` (generated via `next/og`) and `icon.svg` are metadata files.
- **`src/app/page.tsx`** — marketing landing; only composes section components in order: `Nav`, `Hero`, `StatsBar`, `Recursos`, `ComoFunciona`, `Cta`, `Footer`. Each section is a `<section id="...">` matching nav anchors (`#recursos`, `#como-funciona`, `#comecar`). Sections take no props and hold their own copy/data arrays.
- **App routes** — `[slug]` public page (ISR 60 s via `generateStaticParams` returning `[]`; dashboard actions call `revalidatePath`), `go/[id]` tracked redirect, `api/view` view tracking (posted by `ViewTracker`), `media/[id]` serves uploaded images from Postgres (immutable cache), `login` (email + password, `?modo=cadastro` for signup), `dashboard` with tabs: Links (`page.tsx`), `aparencia` (client `AppearanceEditor` with live preview), `resultados` (analytics). All mutations are Server Actions in `dashboard/actions.ts` and `login/actions.ts`. `demo` is a static preview that needs no DB.
- **`src/server/`** (all `server-only`) — `db.ts` (pg Pool + `query`/`queryOne`), `auth.ts` (scrypt passwords, sessions table keyed by sha256 of an httpOnly cookie token, `requireUser`), `media.ts` (image upload ≤ 2 MB, type sniffed from bytes, no SVG), `profiles.ts` (profile/link reads), `analytics.ts` (`trackEvent` with bot filter + dedupe + rate cap; `getStats`). **There is no RLS: every query must filter by the owner's user id in code.**
- **`src/proxy.ts`** — only checks the session cookie exists for `/dashboard`; real validation happens in pages/actions via `requireUser`.
- **`src/lib/`** — `types.ts` (Profile/LinkItem/Appearance, button styles, fonts, theme presets), `validation.ts` (slug/URL/WhatsApp/color), `site.ts` (site URL/name from `NEXT_PUBLIC_SITE_URL`).
- **Public page rendering** — `PageView` takes appearance as CSS variables (`--bio-bg`, `--bio-text`, `--btn-bg`, `--btn-text`) plus `bio-btn-*` / `bio-font-*` classes; the same component renders the public page, `/demo` and the dashboard `PhonePreview`.
- **Analytics** — no IP or cookies stored; a daily visitor hash (`APP_SECRET` + day + profile + IP + UA) counts unique visitors and dedupes (view: 30 min, click: 30 s, max 120 events/visitor/hour). Source comes from in-app UA (Instagram/Facebook/TikTok…) or referrer host. Days are computed in `America/Sao_Paulo`. Chart colors are validated categorical slots `--series-1`/`--series-2`.
- **`src/components/RevealWrapper.tsx`** — polymorphic scroll-in `.reveal` wrapper (`IntersectionObserver`), combine with `.d1`–`.d4` delay classes. `Hero`/`StatsBar` skip it so above-the-fold content shows immediately.
- **Client components** — `Nav`, `RevealWrapper`, `ViewTracker`, `DashTabs`, `AppearanceEditor`, `TrafficChart`.
- **Styling** — plain global CSS in `src/app/globals.css`: CSS custom properties on `:root` (`--ink`, `--paper`, `--lime`, `--whats`, …) plus BEM-ish classes (`.wrap`, `.btn-*`, `.h2`, per-section `.hero-*`, `.feat-*`, `.dash-*`, `.bio-*`). Tailwind v4 is imported but not used for styling — don't add Tailwind utilities ad hoc. Responsive rules are hand-written `@media` blocks at the end (900px, 600px). Public page appearance is driven by `--bio-*`/`--btn-*` variables set inline by `PageView`.
- **Security headers** — set centrally in `next.config.ts`.
- **Database** — `db/migrations/0001_init.sql`: `users`, `sessions`, `media`, `profiles` (incl. appearance columns), `links` (incl. `thumbnail_id`), `events`. Add schema changes as new numbered files, never edit applied ones.

## Next 16 notes

`params`, `searchParams`, `cookies()` and `headers()` are async (await them). `next lint` no longer exists. `middleware` is now `proxy`.
