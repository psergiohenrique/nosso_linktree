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
        slug: 'marina-duarte',
        display_name: 'Marina Duarte',
        bio: 'Projetos residenciais e comerciais com foco em luz natural e conforto. Atendo São Paulo e região.',
        avatar_url: null,
        cover_url: null,
        theme: 'sand',
        accent: '#2b2622',
      }}
      links={[
        { id: '1', kind: 'whatsapp', title: 'Solicitar orçamento pelo WhatsApp', url: 'https://wa.me/5511999999999?text=Quero%20um%20or%C3%A7amento' },
        { id: '2', kind: 'link', title: 'Ver portfólio completo', url: 'https://example.com/portfolio' },
        { id: '3', kind: 'link', title: 'Agendar visita técnica', url: 'https://example.com/agenda' },
        { id: '4', kind: 'link', title: 'Instagram', url: 'https://instagram.com' },
      ]}
    />
  );
}
