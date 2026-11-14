import { SOCIAL_NETWORKS, type SocialLinks } from "@/lib/types";
import { socialUrl } from "@/lib/validation";

/** Redes ativas com URL segura, também usado na prévia enquanto o usuário digita. */
export function visibleSocialLinks(links?: SocialLinks | null) {
  return SOCIAL_NETWORKS.flatMap((network) => {
    const entry = links?.[network];
    const url = entry?.is_active && entry.url ? socialUrl(entry.url, network) : null;
    return url ? [{ network, url: network === "email" ? `mailto:${url}` : url }] : [];
  });
}
