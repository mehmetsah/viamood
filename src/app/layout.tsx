import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Via Mood Vendor Platform',
    template: '%s · Via Mood',
  },
  description: 'Via Mood pazaryeri operatör paneli ve tedarikçi paneli',
  robots: { index: false, follow: false }, // private platform
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
