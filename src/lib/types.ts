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
};

export type Profile = Appearance & {
  id: string;
  slug: string;
  display_name: string;
  bio: string;
  avatar_id: string | null;
};

export type LinkItem = {
  id: string;
  profile_id: string;
  kind: "link" | "whatsapp";
  title: string;
  url: string;
  thumbnail_id: string | null;
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
    },
  },
];

export const mediaUrl = (id: string) => `/media/${id}`;
