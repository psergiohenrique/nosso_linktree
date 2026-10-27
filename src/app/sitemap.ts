import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { mediaUrl } from "@/lib/types";
import { SITE_URL } from "@/lib/site";
import { listIndexablePages } from "@/server/profiles";

// Lido do banco a cada pedido: página nova ou que saiu do Google aparece já na próxima visita do robô.
export const dynamic = "force-dynamic";

/**
 * Limite do Google por arquivo de sitemap. Passando disso, dividir com generateSitemaps
 * (/sitemap/[id].xml) e apontar o robots.ts para cada parte.
 */
const MAX_URLS = 50_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await listIndexablePages(MAX_URLS - 2);
  return [
    {
      url: SITE_URL,
      lastModified: new Date("2026-10-27"),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/demo`,
      lastModified: new Date("2026-10-15"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    ...pages.map((p) => ({
      url: absoluteUrl(`/${p.slug}`),
      lastModified: p.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      ...(p.avatar_id && { images: [absoluteUrl(mediaUrl(p.avatar_id))] }),
    })),
  ];
}
