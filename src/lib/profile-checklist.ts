import type { LinkItem, Profile } from "./types";

export type ChecklistItem = {
  id: "avatar" | "bio" | "cover" | "whatsapp";
  label: string;
  hint: string;
  done: boolean;
  /** Para onde o botão leva: uma aba do painel, ou abrir a folha de novo link. */
  action: { kind: "href"; href: string; label: string } | { kind: "new-link"; label: string };
};

/** Os quatro passos que mais ajudam uma página a converter. É só um lembrete: nada é obrigatório. */
export function profileChecklist(
  profile: Pick<Profile, "avatar_id" | "bio" | "cover_image_id">,
  links: Pick<LinkItem, "kind" | "is_active">[],
): ChecklistItem[] {
  return [
    {
      id: "avatar",
      label: "Foto de perfil",
      hint: "Quem vê a foto reconhece você e confia mais.",
      done: Boolean(profile.avatar_id),
      action: { kind: "href", href: "/dashboard/aparencia", label: "Adicionar foto" },
    },
    {
      id: "bio",
      label: "Bio curta",
      hint: "Uma frase sobre o que você faz e para quem.",
      done: profile.bio.trim().length > 0,
      action: { kind: "href", href: "/dashboard/aparencia", label: "Escrever bio" },
    },
    {
      id: "cover",
      label: "Imagem de capa",
      hint: "Uma foto do seu trabalho no topo da página.",
      done: Boolean(profile.cover_image_id),
      action: { kind: "href", href: "/dashboard/aparencia", label: "Adicionar capa" },
    },
    {
      id: "whatsapp",
      label: "Botão do WhatsApp",
      hint: "O caminho mais curto do seu cliente até uma conversa.",
      done: links.some((l) => l.kind === "whatsapp" && l.is_active),
      action: { kind: "new-link", label: "Adicionar WhatsApp" },
    },
  ];
}
