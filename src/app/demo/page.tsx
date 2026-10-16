import type { Metadata } from "next";
import Playground from "@/components/Playground";

export const metadata: Metadata = {
  title: "Playground — monte sua página",
  description: "Teste temas, cores, botões, fontes e formatos de link do Linkbio. Nada é salvo.",
  alternates: { canonical: "/demo" },
};

// Funciona sem banco de dados: todo o estado fica no navegador.
export default function Demo() {
  return <Playground />;
}
