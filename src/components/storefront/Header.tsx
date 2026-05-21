import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

interface NavItem {
  label: string;
  href: string;
}

const PRIMARY_NAV: NavItem[] = [
  { label: 'Tüm Ürünler', href: '/shop' },
  { label: 'Mutfak', href: '/koleksiyon/mutfak' },
  { label: 'Baharat', href: '/koleksiyon/baharat' },
  { label: 'Zeytinyağı', href: '/koleksiyon/zeytinyagi' },
  { label: 'Tekstil', href: '/koleksiyon/tekstil' },
  { label: 'Hakkımızda', href: '/hakkimizda' },
];

export function StorefrontHeader() {
  return (
    <header className="bg-[var(--color-brand-cream)] border-b border-[var(--color-brand-ink)]/10">
      {/* Top promo bar */}
      <div className="bg-[var(--color-brand-ink)] text-[var(--color-brand-cream)] text-xs py-2 text-center tracking-wider uppercase">
        Türkiye geneli ücretsiz kargo · 500 ₺ üzeri siparişlerde
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="flex items-center justify-between py-5 md:py-7">
          {/* Sol: ara */}
          <div className="hidden md:flex items-center gap-6 w-1/3">
            <button
              type="button"
              aria-label="Ara"
              className="flex items-center gap-2 text-sm font-medium tracking-wider uppercase link-underline"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
              </svg>
              Ara
            </button>
          </div>

          {/* Orta: Logo */}
          <Link
            href="/"
            className="flex-1 md:flex-none flex items-center justify-center md:w-1/3"
            aria-label="Via Mood ana sayfa"
          >
            <Logo width={140} priority />
          </Link>

          {/* Sağ: hesap + sepet */}
          <div className="flex items-center justify-end gap-5 md:w-1/3 text-sm font-medium tracking-wider uppercase">
            <Link href="/auth/sign-in" className="link-underline hidden md:inline" aria-label="Hesap">
              Hesap
            </Link>
            <a
              href="https://via-mood.myshopify.com/cart"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 link-underline"
              aria-label="Sepet"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 6h15l-1.5 9h-12L6 6z" strokeLinejoin="round" />
                <path d="M6 6L5 3H2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="20" r="1.2" fill="currentColor" />
                <circle cx="18" cy="20" r="1.2" fill="currentColor" />
              </svg>
              Sepet
            </a>
          </div>
        </div>

        {/* Primary nav */}
        <nav className="hidden md:flex items-center justify-center gap-8 pb-5">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] font-medium tracking-[0.16em] uppercase link-underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile nav scroll */}
        <nav className="md:hidden flex items-center gap-5 pb-4 overflow-x-auto whitespace-nowrap text-xs font-medium tracking-widest uppercase">
          {PRIMARY_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="link-underline">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
