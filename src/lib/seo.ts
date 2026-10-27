import type { Metadata } from "next";
import { COMPANY_NAME, COMPANY_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./site";
import { PRO_PRICES } from "./billing";

/**
 * SEO compartilhado. O Next mescla metadados de forma rasa: quem define `openGraph` ou `twitter`
 * substitui o objeto inteiro do layout. Por isso cada página monta os dois com `socialMetadata`,
 * em vez de herdar do layout (que deixaria og:url e og:title do site nas páginas dos usuários).
 */

export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export function socialMetadata({
  title,
  description,
  path,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "profile";
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: { type, locale: "pt_BR", siteName: SITE_NAME, url: absoluteUrl(path), title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * A página do usuário entra no Google (e no sitemap)? Só com a opção ligada e conteúdo mínimo:
 * nome ou bio e pelo menos um link ativo. Página vazia é conteúdo raso e pesa contra o domínio todo.
 * `activeLinks`: quantos links ativos aparecem na página.
 */
export function isIndexable(
  profile: { search_indexing: boolean; display_name: string; bio: string },
  activeLinks: number,
) {
  return profile.search_indexing && (profile.display_name.trim() !== "" || profile.bio.trim() !== "") && activeLinks > 0;
}

/** Condição SQL equivalente a isIndexable, para o sitemap (alias p = profiles). */
export const INDEXABLE_SQL = `p.search_indexing and (btrim(p.display_name) <> '' or btrim(p.bio) <> '')
  and exists (select 1 from links l where l.profile_id = p.id and l.is_active)`;

/** Corta no limite sem quebrar palavra, com reticências. */
export function truncate(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, "")}…`;
}

/** JSON-LD do produto (só na home): empresa, aplicativo com os planos e o site. */
export function productJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${COMPANY_URL}/#organization`,
        name: COMPANY_NAME,
        url: COMPANY_URL,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        publisher: { "@id": `${COMPANY_URL}/#organization` },
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "pt-BR",
        offers: [
          { "@type": "Offer", name: "Grátis", price: "0", priceCurrency: "BRL", url: `${SITE_URL}/#planos` },
          ...(["monthly", "yearly"] as const).map((cycle) => ({
            "@type": "Offer",
            name: PRO_PRICES[cycle].name.replace("Linkbio ", ""),
            price: (PRO_PRICES[cycle].cents / 100).toFixed(2),
            priceCurrency: "BRL",
            url: `${SITE_URL}/#planos`,
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: (PRO_PRICES[cycle].cents / 100).toFixed(2),
              priceCurrency: "BRL",
              billingDuration: 1,
              unitCode: cycle === "monthly" ? "MON" : "ANN",
            },
          })),
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: `Site oficial do ${SITE_NAME}, plataforma de link na bio da ${COMPANY_NAME} para pequenos negócios.`,
        publisher: { "@id": `${COMPANY_URL}/#organization` },
        inLanguage: "pt-BR",
      },
    ],
  };
}

/** JSON dentro de <script>: escapa "<" para um texto do usuário não fechar a tag. */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

// ───────── Páginas dos usuários ─────────

type PublicProfile = { slug: string; display_name: string; bio: string };

export const profileName = (p: PublicProfile) => p.display_name.trim() || `@${p.slug}`;

/** “Barbearia do Zé (@barbeariadoze)”; sem nome, só “@slug”. O template do layout acrescenta “· Linkbio”. */
export function profileTitle(p: PublicProfile) {
  const name = p.display_name.trim();
  return name ? `${name} (@${p.slug})` : `@${p.slug}`;
}

/** A bio; sem bio, uma frase com os primeiros links (“Links de X: Agendar, Instagram e Cardápio.”). */
export function profileDescription(p: PublicProfile, linkTitles: string[]) {
  if (p.bio.trim()) return truncate(p.bio, 160);
  const titles = linkTitles.map((t) => t.trim()).filter(Boolean).slice(0, 4);
  const list = titles.length > 1 ? `${titles.slice(0, -1).join(", ")} e ${titles.at(-1)}` : titles[0];
  return truncate(list ? `Links de ${profileName(p)}: ${list}.` : `Links de ${profileName(p)}.`, 160);
}

/** Hosts de redes sociais e perfis públicos que viram sameAs no JSON-LD. */
const SOCIAL_HOSTS = [
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "youtube.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "threads.net",
  "threads.com",
  "pinterest.com",
  "behance.net",
  "github.com",
  "spotify.com",
  "soundcloud.com",
  "twitch.tv",
];

/** URLs de perfis em redes sociais (sem repetir), para o sameAs. */
export function socialProfiles(urls: string[]) {
  const out = new Set<string>();
  for (const raw of urls) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    const host = url.hostname.replace(/^(www|m)\./, "");
    // Só o perfil: link para um post específico também serve, mas a raiz da rede não.
    if (SOCIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) && url.pathname.length > 1) {
      out.add(`https://${host}${url.pathname.replace(/\/$/, "")}`);
    }
  }
  return [...out];
}

/**
 * JSON-LD da página do usuário: ProfilePage cuja entidade principal é o negócio (Organization, o
 * público do produto), com as redes sociais em sameAs.
 */
export function profileJsonLd(
  p: PublicProfile & { updated_at: Date },
  { avatarUrl, linkUrls }: { avatarUrl: string | null; linkUrls: string[] },
) {
  const url = absoluteUrl(`/${p.slug}`);
  const sameAs = socialProfiles(linkUrls);
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${url}#page`,
    url,
    name: profileTitle(p),
    inLanguage: "pt-BR",
    dateModified: p.updated_at.toISOString(),
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME },
    mainEntity: {
      "@type": "Organization",
      "@id": `${url}#entity`,
      name: profileName(p),
      alternateName: `@${p.slug}`,
      url,
      ...(p.bio.trim() && { description: p.bio.trim() }),
      ...(avatarUrl && { image: absoluteUrl(avatarUrl) }),
      ...(sameAs.length > 0 && { sameAs }),
    },
  };
}
