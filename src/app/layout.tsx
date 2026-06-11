import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import { AppProviders } from '@/components/providers/app-providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const sora = Sora({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: { default: 'Bolão 2026 — Copa do Mundo', template: '%s · Bolão 2026' },
  description:
    'O bolão definitivo da Copa do Mundo 2026. Crie ligas com amigos, faça palpites e dispute o ranking em tempo real.',
  openGraph: {
    title: 'Bolão 2026',
    description: 'Palpites, rankings ao vivo e resenha garantida na Copa 2026.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#06130b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.variable} ${sora.variable} font-sans`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
