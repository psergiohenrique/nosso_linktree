import type { PageViewProfile } from "@/components/PageView";
import { EMPTY_SOCIAL_LINKS, type EditorLink } from "./editor";
import { LINK_LAYOUTS, LINK_SIZES, THEME_PRESETS, WHATSAPP_DEFAULT } from "./types";
import { MAX_URL_LENGTH, oneOf, safeUrl, whatsappUrl } from "./validation";

export const EXAMPLE_PROFILE: PageViewProfile = {
  ...THEME_PRESETS[2].appearance,
  ...WHATSAPP_DEFAULT,
  show_avatar: true,
  slug: "barbearia-do-ze",
  display_name: "Barbearia do Zé",
  bio: "Corte, barba e cerveja gelada. Seg a sáb, 9h às 20h.",
  avatar_url: "/demo/avatar.svg",
  cover_image_url: null,
  social_position: "below_name",
  social_links: EMPTY_SOCIAL_LINKS,
};

export const EXAMPLE_LINKS: EditorLink[] = [
  { id: "1", kind: "whatsapp", title: "Agendar pelo WhatsApp", url: "https://wa.me/5511999999999?text=Quero%20agendar", thumbnail_url: null, layout: "button", size: "lg", is_active: true },
  { id: "2", kind: "link", title: "Tabela de preços", url: "https://example.com/precos", thumbnail_url: "/demo/precos.svg", layout: "featured", size: "md", is_active: true },
  { id: "3", kind: "link", title: "Como chegar", url: "https://maps.google.com", thumbnail_url: "/demo/mapa.svg", layout: "tile", size: "md", is_active: true },
  { id: "4", kind: "link", title: "Instagram", url: "https://instagram.com", thumbnail_url: "/demo/insta.svg", layout: "tile", size: "md", is_active: true },
  { id: "5", kind: "link", title: "Avaliações no Google", url: "https://google.com", thumbnail_url: null, layout: "button", size: "sm", is_active: true },
];

/** A mesma entrada FormData dos formulários do painel, sem efeitos de servidor. */
export function readPlaygroundLink(data: FormData) {
  const kind: EditorLink["kind"] = data.get("kind") === "whatsapp" ? "whatsapp" : "link";
  const raw = String(data.get("url") ?? "");
  const url = kind === "whatsapp" ? whatsappUrl(raw, String(data.get("message") ?? "")) : safeUrl(raw);
  return {
    kind,
    url: url && url.length <= MAX_URL_LENGTH ? url : null,
    title: String(data.get("title") ?? "").slice(0, 80),
    layout: oneOf(data.get("layout"), LINK_LAYOUTS.map((l) => l.value), "button"),
    size: oneOf(data.get("size"), LINK_SIZES.map((s) => s.value), "md"),
  };
}

/** Durante a digitação, uma URL incompleta não vira um destino inseguro na prévia. */
export function playgroundLinkDraft(current: EditorLink, data: FormData): EditorLink {
  const fields = readPlaygroundLink(data);
  return {
    ...current,
    ...fields,
    url: fields.url ?? current.url,
    is_active: data.get("is_active") === "on",
    thumbnail_url: data.get("remove_thumbnail") === "on" ? null : current.thumbnail_url,
  };
}

/** Ignora ids desconhecidos/duplicados e mantém links que tenham sido adicionados durante o arrasto. */
export function reorderPlaygroundLinks(links: EditorLink[], ids: string[]): EditorLink[] {
  const byId = new Map(links.map((link) => [link.id, link]));
  const order = [...new Set([...ids, ...byId.keys()])];
  return order.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
}
