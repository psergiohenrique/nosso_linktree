export type BgType = "solid" | "gradient";
export type ButtonStyle = "rounded" | "pill" | "square" | "outline" | "shadow";
export type FontKey = "manrope" | "bricolage" | "serif" | "mono";

export type Appearance = {
  bg_type: BgType;
  bg_color: string;
  bg_color2: string;
  text_color: string;
  button_color: string;
  button_text_color: string;
  button_style: ButtonStyle;
  font: FontKey;
  /** Círculo com a inicial (sem foto). Null: segue as cores do botão. */
  initial_bg_color: string | null;
  initial_text_color: string | null;
};

/**
 * Botão de WhatsApp: verde do WhatsApp, igual aos outros botões (theme) ou cores próprias (custom).
 * Fica fora de Appearance para os temas prontos não mexerem nele.
 */
export type WhatsappStyle = "green" | "theme" | "custom";

export type WhatsappAppearance = {
  whatsapp_style: WhatsappStyle;
  whatsapp_color: string;
  whatsapp_text_color: string;
};

export const WHATSAPP_DEFAULT: WhatsappAppearance = {
  whatsapp_style: "green",
  whatsapp_color: "#1f9d55",
  whatsapp_text_color: "#ffffff",
};

export const WHATSAPP_STYLES: { value: WhatsappStyle; label: string }[] = [
  { value: "green", label: "Verde do WhatsApp" },
  { value: "theme", label: "Igual aos outros" },
  { value: "custom", label: "Cores próprias" },
];

export type Profile = Appearance &
  WhatsappAppearance & {
    id: string;
    slug: string;
    display_name: string;
    bio: string;
    avatar_id: string | null;
  };

export type LinkLayout = "button" | "featured" | "tile";
export type LinkSize = "sm" | "md" | "lg";

export type LinkItem = {
  id: string;
  profile_id: string;
  kind: "link" | "whatsapp";
  title: string;
  url: string;
  thumbnail_id: string | null;
  layout: LinkLayout;
  size: LinkSize;
  position: number;
  is_active: boolean;
};

export const BUTTON_STYLES: { value: ButtonStyle; label: string }[] = [
  { value: "rounded", label: "Arredondado" },
  { value: "pill", label: "Pílula" },
  { value: "square", label: "Reto" },
  { value: "outline", label: "Contorno" },
  { value: "shadow", label: "Sombra" },
];

export const LINK_LAYOUTS: { value: LinkLayout; label: string; hint: string }[] = [
  { value: "button", label: "Botão", hint: "Botão com miniatura opcional ao lado do título" },
  { value: "featured", label: "Destaque", hint: "Imagem grande em cima, título embaixo" },
  { value: "tile", label: "Bloco", hint: "Quadrado com imagem; blocos seguidos ficam lado a lado" },
];

export const LINK_SIZES: { value: LinkSize; label: string }[] = [
  { value: "sm", label: "Pequeno" },
  { value: "md", label: "Médio" },
  { value: "lg", label: "Grande" },
];

export const FONTS: { value: FontKey; label: string }[] = [
  { value: "manrope", label: "Moderna" },
  { value: "bricolage", label: "Marcante" },
  { value: "serif", label: "Elegante" },
  { value: "mono", label: "Máquina" },
];

export const THEME_PRESETS: { name: string; appearance: Appearance }[] = [
  {
    name: "Claro",
    appearance: {
      bg_type: "solid",
      bg_color: "#f4f2ec",
      bg_color2: "#f4f2ec",
      text_color: "#17181a",
      button_color: "#ffffff",
      button_text_color: "#17181a",
      button_style: "rounded",
      font: "manrope",
      initial_bg_color: null,
      initial_text_color: null,
    },
  },
  {
    name: "Escuro",
    appearance: {
      bg_type: "solid",
      bg_color: "#0f1011",
      bg_color2: "#0f1011",
      text_color: "#f4f2ec",
      button_color: "#1f2023",
      button_text_color: "#f4f2ec",
      button_style: "rounded",
      font: "manrope",
      initial_bg_color: null,
      initial_text_color: null,
    },
  },
  {
    name: "Pôr do sol",
    appearance: {
      bg_type: "gradient",
      bg_color: "#ffe9d6",
      bg_color2: "#d9dcf6",
      text_color: "#17181a",
      button_color: "#ffffff",
      button_text_color: "#17181a",
      button_style: "pill",
      font: "bricolage",
      initial_bg_color: null,
      initial_text_color: null,
    },
  },
  {
    name: "Lima",
    appearance: {
      bg_type: "solid",
      bg_color: "#17181a",
      bg_color2: "#17181a",
      text_color: "#ffffff",
      button_color: "#c8f169",
      button_text_color: "#17181a",
      button_style: "shadow",
      font: "bricolage",
      initial_bg_color: null,
      initial_text_color: null,
    },
  },
  {
    name: "Oceano",
    appearance: {
      bg_type: "gradient",
      bg_color: "#0b3b5c",
      bg_color2: "#1d8a8a",
      text_color: "#ffffff",
      button_color: "#ffffff",
      button_text_color: "#0b3b5c",
      button_style: "outline",
      font: "manrope",
      initial_bg_color: null,
      initial_text_color: null,
    },
  },
  {
    name: "Papel",
    appearance: {
      bg_type: "solid",
      bg_color: "#fbf7ef",
      bg_color2: "#fbf7ef",
      text_color: "#3b2f22",
      button_color: "#3b2f22",
      button_text_color: "#fbf7ef",
      button_style: "square",
      font: "serif",
      initial_bg_color: null,
      initial_text_color: null,
    },
  },
];

export const mediaUrl = (id: string) => `/media/${id}`;
