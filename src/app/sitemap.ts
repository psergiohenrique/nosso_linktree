import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date("2026-10-15"),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/demo`,
      lastModified: new Date("2026-10-15"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
