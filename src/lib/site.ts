export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Host exibido antes do slug (ex.: linkbio.dev.br). */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

export const SITE_NAME = "Linkbio";

// O produto é da CodePath; a marca da empresa assina o produto ("Linkbio by CodePath").
export const COMPANY_NAME = "CodePath";
export const COMPANY_URL = "https://codepath.dev.br";

export const SITE_TITLE = "Linkbio — Seu link na bio, feito para vender no WhatsApp";

export const SITE_DESCRIPTION =
  "Crie sua página de links em minutos, com botão de WhatsApp e métricas de cliques. Sem comissão sobre vendas, sem marca d'água agressiva. Para pequenos negócios e agências.";
