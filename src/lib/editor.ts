import { SOCIAL_NETWORKS, type SocialLinks } from "./types";
import type { PageViewLink } from "@/components/PageView";

export const EMPTY_SOCIAL_LINKS = Object.fromEntries(SOCIAL_NETWORKS.map((network) => [network, { url: "", is_active: false }])) as SocialLinks;

/** Dados de apresentação: não dependem de ids de mídia nem de registros do banco. */
export type EditorLink = PageViewLink & { is_active: boolean; pix?: { name: string; city: string } };

/** Uma Server Action no painel ou uma operação em memória no demo. */
export type EditorFormAction = (data: FormData) => Promise<void>;

export type LinkEditorActions = {
  create: EditorFormAction;
  update: EditorFormAction;
  remove: EditorFormAction;
  reorder: (ids: string[]) => Promise<void>;
};

export type LinkEditorAccess = {
  proLayouts: boolean;
  atLimit: boolean;
  limit: number;
  /** Só quando o Pix está ligado (PIX_ENABLED). O demo não oferece o bloco. */
  pix?: { business: boolean };
};
