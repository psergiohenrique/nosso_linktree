import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Páginas dos usuários e imagens (/media) ficam liberadas; páginas fora do critério levam noindex nelas mesmas.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/login", "/api/", "/go/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
