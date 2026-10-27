import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import StatsBar from "@/components/StatsBar";
import Recursos from "@/components/Recursos";
import ComoFunciona from "@/components/ComoFunciona";
import Planos from "@/components/Planos";
import Cta from "@/components/Cta";
import Footer from "@/components/Footer";
import { jsonLdString, productJsonLd, socialMetadata } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  keywords: [
    "link na bio",
    "linktree alternativa",
    "página de links",
    "link na bio WhatsApp",
    "botão de WhatsApp Instagram",
    "link na bio para pequenos negócios",
    "link na bio sem comissão",
    "Linkbio",
    "Linkbio CodePath",
  ],
  alternates: {
    canonical: "/",
  },
  ...socialMetadata({
    title: SITE_TITLE,
    description: "Página de links com botão de WhatsApp em destaque e métricas de cliques. Sem comissão sobre vendas.",
    path: "/",
  }),
};

// Estática (sem ler cookies): o menu descobre a sessão no navegador (useLoggedIn).
export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(productJsonLd()) }} />
      <Nav />
      <main>
        <Hero />
        <StatsBar />
        <Recursos />
        <ComoFunciona />
        <Planos />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
