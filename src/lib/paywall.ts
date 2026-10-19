// Textos dos avisos de recurso Pro (paywall), sem banco nem rede: usados no cliente.
import { FREE_LINK_LIMIT, FREE_STATS_DAYS } from "./billing";

export type PaywallFeature = "featured" | "tile" | "links" | "stats" | "csv" | "branding";

export const PAYWALL: Record<PaywallFeature, { title: string; text: string }> = {
  featured: {
    title: "Destaque é um formato do Pro",
    text: "Imagem grande em cima e título embaixo: ideal para promoção, cardápio ou o produto do mês.",
  },
  tile: {
    title: "Bloco é um formato do Pro",
    text: "Quadrados com imagem, dois por linha, como uma vitrine. Ótimo para serviços e produtos.",
  },
  links: {
    title: `O Grátis vai até ${FREE_LINK_LIMIT} links`,
    text: "Com o Pro você adiciona quantos links quiser: catálogo, avaliações, localização, redes, promoções.",
  },
  stats: {
    title: "Métricas completas são do Pro",
    text: `Veja 30 e 90 dias (no Grátis, ${FREE_STATS_DAYS}), de onde vem quem clica em cada link, horários de pico, cidades e campanhas.`,
  },
  csv: {
    title: "Exportar planilha é do Pro",
    text: "Baixe todas as visitas e cliques em CSV para abrir no Excel ou no Google Planilhas.",
  },
  branding: {
    title: "Tirar o selo é do Pro",
    text: "Sua página fica só com a sua marca, sem o “Feito com Linkbio” no rodapé.",
  },
};

/** O que o Pro inclui, mostrado em todos os avisos. */
export const PAYWALL_PRO_LIST = [
  "Links ilimitados",
  "Formatos Destaque e Bloco",
  "Resultados de 30 e 90 dias e métricas avançadas",
  "Sem o selo “Feito com Linkbio”",
];
