import type { Metadata } from "next";
import Playground from "@/components/Playground";
import { socialMetadata } from "@/lib/seo";

const DESCRIPTION = "Teste temas, cores, botões, fontes e formatos de link do Linkbio. Nada é salvo.";

export const metadata: Metadata = {
  title: "Playground — monte sua página",
  description: DESCRIPTION,
  alternates: { canonical: "/demo" },
  ...socialMetadata({ title: "Playground do Linkbio — monte sua página", description: DESCRIPTION, path: "/demo" }),
};

// Funciona sem banco de dados: todo o estado fica no navegador.
export default function Demo() {
  return <Playground />;
}
