import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Linkbio — sua página de links com WhatsApp e métricas',
  description: 'Crie sua página de links em minutos. Botão de WhatsApp, analytics e sem comissão.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
