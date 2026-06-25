import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

/**
 * Müşteri vitrini (storefront) shell — admin/vendor panelinden bağımsız.
 * FAZ 2 Dilim 5: Shopify temasının native karşılığı (katalog → PDP → sepet → checkout).
 */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-brand-cream,#faf6ec)] flex flex-col">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/magaza" className="flex items-center gap-2">
            <Logo width={120} />
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/magaza" className="hover:text-[var(--color-brand-orange)]">Ürünler</Link>
            <Link href="/hesabim" className="hover:text-[var(--color-brand-orange)]">Hesabım</Link>
            <Link href="/sepet" className="font-medium px-4 py-2 rounded-full bg-[var(--color-brand-ink)] text-white hover:opacity-90">
              🛒 Sepet
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-white mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-neutral-500 flex flex-wrap gap-x-8 gap-y-2 justify-between">
          <span>© {new Date().getFullYear()} Via Mood</span>
          <div className="flex gap-5">
            <Link href="/magaza" className="hover:underline">Ürünler</Link>
            <Link href="/hesabim" className="hover:underline">Siparişlerim</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
