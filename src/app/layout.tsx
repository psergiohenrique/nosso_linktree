import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { COMPANY_NAME, COMPANY_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

const bricolage = localFont({
  src: "./fonts/BricolageGrotesque.ttf",
  weight: "500 800",
  variable: "--font-bricolage",
  display: "swap",
});

const manrope = localFont({
  src: "./fonts/Manrope.ttf",
  weight: "400 700",
  variable: "--font-manrope",
  display: "swap",
});

// Fontes extras só usadas nas páginas públicas que escolherem esse estilo: sem preload.
const dmSerif = localFont({
  src: "./fonts/DMSerifDisplay-Regular.ttf",
  weight: "400",
  adjustFontFallback: "Times New Roman",
  variable: "--font-dm-serif",
  display: "swap",
  preload: false,
});

const spaceMono = localFont({
  src: [
    { path: "./fonts/SpaceMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/SpaceMono-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-space-mono",
  display: "swap",
  preload: false,
});

// Só o que vale para todas as rotas. Título, descrição, Open Graph e JSON-LD de cada página ficam nela
// (a home tem os do produto; as páginas dos usuários, os delas): o merge do Next é raso.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: COMPANY_NAME, url: COMPANY_URL }],
  creator: COMPANY_NAME,
  publisher: COMPANY_NAME,
  formatDetection: { telephone: false, email: false, address: false },
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
  ...(process.env.GOOGLE_SITE_VERIFICATION && {
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  }),
};

export const viewport: Viewport = {
  themeColor: "#f4f2ec",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${manrope.variable} ${dmSerif.variable} ${spaceMono.variable}`}>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
