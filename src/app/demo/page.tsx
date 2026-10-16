import type { Metadata } from "next";
import PageView from "@/components/PageView";
import { THEME_PRESETS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Exemplo de página",
  alternates: { canonical: "/demo" },
};

// Prévia estática: funciona sem banco de dados.
export default function Demo() {
  return (
    <PageView
      tracked={false}
      profile={{
        ...THEME_PRESETS[2].appearance,
        slug: "barbearia-do-ze",
        display_name: "Barbearia do Zé",
        bio: "Corte, barba e cerveja gelada. Seg a sáb, 9h às 20h.",
        avatar_url: null,
      }}
      links={[
        { id: "1", kind: "whatsapp", title: "Agendar pelo WhatsApp", url: "https://wa.me/5511999999999?text=Quero%20agendar", thumbnail_url: null, layout: "button", size: "lg" },
        { id: "2", kind: "link", title: "Ver tabela de preços", url: "https://example.com/precos", thumbnail_url: null, layout: "button", size: "md" },
        { id: "3", kind: "link", title: "Como chegar", url: "https://maps.google.com", thumbnail_url: null, layout: "button", size: "md" },
        { id: "4", kind: "link", title: "Instagram", url: "https://instagram.com", thumbnail_url: null, layout: "button", size: "md" },
      ]}
    />
  );
}
