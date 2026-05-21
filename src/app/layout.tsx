import type { Metadata } from 'next';
import { Cormorant_Garamond, DM_Sans } from 'next/font/google';
import './globals.css';

const serif = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
});

const sans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Via Mood — Doğanın Renkleriyle Modern Yaşam',
    template: '%s · Via Mood',
  },
  description:
    'Via Mood pazaryerinde el yapımı mutfak gereçleri, doğal baharatlar, Ege zeytinyağları ve Anadolu tekstil. Türkiye\'nin küçük üreticilerinin ürünleri tek çatı altında.',
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'Via Mood',
    title: 'Via Mood — Doğanın Renkleriyle Modern Yaşam',
    description: 'Küçük üreticilerin el yapımı ve doğal ürünleri',
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
