import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Serif_Display, Manrope, Space_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { COMPANY_NAME, COMPANY_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import { PRO_PRICES } from "@/lib/billing";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  weight: ["500", "700", "800"],
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const manrope = Manrope({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

// Fontes extras só usadas nas páginas públicas que escolherem esse estilo: sem preload.
const dmSerif = DM_Serif_Display({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-dm-serif",
  display: "swap",
  preload: false,
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
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
  authors: [{ name: COMPANY_NAME, url: COMPANY_URL }],
  creator: COMPANY_NAME,
  publisher: COMPANY_NAME,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    title: SITE_TITLE,
    description:
      "Página de links com botão de WhatsApp em destaque e métricas de cliques. Sem comissão sobre vendas.",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: "Página de links com botão de WhatsApp e métricas. Sem comissão sobre vendas.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${manrope.variable} ${dmSerif.variable} ${spaceMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${COMPANY_URL}/#organization`,
                  name: COMPANY_NAME,
                  url: COMPANY_URL,
                },
                {
                  "@type": "SoftwareApplication",
                  "@id": `${SITE_URL}/#app`,
                  name: SITE_NAME,
                  description: SITE_DESCRIPTION,
                  url: SITE_URL,
                  publisher: { "@id": `${COMPANY_URL}/#organization` },
                  applicationCategory: "BusinessApplication",
                  operatingSystem: "Web",
                  inLanguage: "pt-BR",
                  offers: [
                    { "@type": "Offer", name: "Grátis", price: "0", priceCurrency: "BRL", url: `${SITE_URL}/#planos` },
                    ...(["monthly", "yearly"] as const).map((cycle) => ({
                      "@type": "Offer",
                      name: PRO_PRICES[cycle].name.replace("Linkbio ", ""),
                      price: (PRO_PRICES[cycle].cents / 100).toFixed(2),
                      priceCurrency: "BRL",
                      url: `${SITE_URL}/#planos`,
                      priceSpecification: {
                        "@type": "UnitPriceSpecification",
                        price: (PRO_PRICES[cycle].cents / 100).toFixed(2),
                        priceCurrency: "BRL",
                        billingDuration: 1,
                        unitCode: cycle === "monthly" ? "MON" : "ANN",
                      },
                    })),
                  ],
                },
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}/#website`,
                  url: SITE_URL,
                  name: SITE_NAME,
                  description: `Site oficial do ${SITE_NAME}, plataforma de link na bio da ${COMPANY_NAME} para pequenos negócios.`,
                  publisher: { "@id": `${COMPANY_URL}/#organization` },
                  inLanguage: "pt-BR",
                },
              ],
            }),
          }}
        />
      </head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
