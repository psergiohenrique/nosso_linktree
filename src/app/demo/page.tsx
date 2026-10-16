import type { Metadata } from "next";
import PageView from "@/components/PageView";

export const metadata: Metadata = {
  title: "Exemplo de página",
  alternates: { canonical: "/demo" },
};

// Prévia estática: funciona sem Supabase configurado.
export default function Demo() {
  return (
    <PageView
      tracked={false}
      profile={{
        slug: 'barbearia-do-ze',
        display_name: 'Barbearia do Zé',
        bio: 'Corte, barba e cerveja gelada. Seg a sáb, 9h às 20h.',
        avatar_url: null,
        theme: 'sunset',
        accent: '#4f46e5',
      }}
      links={[
        { id: '1', kind: 'whatsapp', title: 'Agendar pelo WhatsApp', url: 'https://wa.me/5511999999999?text=Quero%20agendar' },
        { id: '2', kind: 'link', title: 'Ver tabela de preços', url: 'https://example.com/precos' },
        { id: '3', kind: 'link', title: 'Como chegar', url: 'https://maps.google.com' },
        { id: '4', kind: 'link', title: 'Instagram', url: 'https://instagram.com' },
      ]}
    />
  );
}
