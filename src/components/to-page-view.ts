import "server-only";
import { applyPlanToLinks, type LinkAccess } from "@/lib/billing";
import { pixOnPage, tryPixPayload } from "@/lib/pix";
import { pixQrSvg } from "@/lib/pix-qr";
import { mediaUrl, type LinkItem, type Profile } from "@/lib/types";
import type { PlanState } from "@/lib/billing";
import type { PageViewLink, PageViewProfile } from "./PageView";

/** O que a página pode mostrar deste plano. Pix só no Business, e só com PIX_ENABLED. */
export function linkAccess(plan: PlanState): LinkAccess {
  return { pro: plan.pro, pix: pixOnPage(plan) };
}

/**
 * Converte perfil e links do banco nas props da página (ids de mídia viram URLs) e aplica o plano:
 * no Grátis, só os primeiros links, todos como botão, e com o selo. O QR do Pix nasce aqui,
 * no servidor, para a página pública não carregar a lib no navegador.
 */
export function toPageViewProps(profile: Profile, links: LinkItem[], access: boolean | LinkAccess | PlanState = true) {
  const resolved: boolean | LinkAccess =
    typeof access === "boolean" ? access : "kind" in access ? linkAccess(access) : access;
  const pro = typeof resolved === "boolean" ? resolved : resolved.pro;

  return {
    profile: {
      ...profile,
      avatar_url: profile.avatar_id ? mediaUrl(profile.avatar_id) : null,
      cover_image_url: profile.cover_image_id ? mediaUrl(profile.cover_image_id) : null,
    } satisfies PageViewProfile,
    links: applyPlanToLinks(links, resolved).map((l): PageViewLink => {
      const pixCode = l.kind === "pix" ? tryPixPayload(l.url, l.config) : null;
      return {
        id: l.id,
        title: l.title,
        url: l.url,
        kind: l.kind,
        layout: l.layout,
        size: l.size,
        thumbnail_url: l.thumbnail_id ? mediaUrl(l.thumbnail_id) : null,
        pixCode,
        pixSvg: pixCode ? pixQrSvg(pixCode) : null,
      };
    }),
    branding: !pro,
  };
}
