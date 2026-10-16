import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
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
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
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
    <html lang="pt-BR" className={`${bricolage.variable} ${manrope.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "SoftwareApplication",
                  "@id": `${SITE_URL}/#app`,
                  name: SITE_NAME,
                  description: SITE_DESCRIPTION,
                  url: SITE_URL,
                  applicationCategory: "BusinessApplication",
                  operatingSystem: "Web",
                  inLanguage: "pt-BR",
                  offers: {
                    "@type": "Offer",
                    price: "0",
                    priceCurrency: "BRL",
                  },
                },
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}/#website`,
                  url: SITE_URL,
                  name: SITE_NAME,
                  description: "Site oficial do Linkbio, plataforma de link na bio para pequenos negócios.",
                  publisher: { "@id": `${SITE_URL}/#app` },
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
