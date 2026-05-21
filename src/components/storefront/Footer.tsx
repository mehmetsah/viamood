import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

const FOOTER_GROUPS = [
  {
    title: 'Mağaza',
    links: [
      { label: 'Tüm Ürünler', href: '/shop' },
      { label: 'Mutfak', href: '/koleksiyon/mutfak' },
      { label: 'Baharat', href: '/koleksiyon/baharat' },
      { label: 'Zeytinyağı', href: '/koleksiyon/zeytinyagi' },
      { label: 'Tekstil', href: '/koleksiyon/tekstil' },
    ],
  },
  {
    title: 'Kurumsal',
    links: [
      { label: 'Hakkımızda', href: '/hakkimizda' },
      { label: 'Tedarikçi Olun', href: '/auth/sign-up' },
      { label: 'Tedarikçi Girişi', href: '/auth/sign-in' },
      { label: 'İletişim', href: '/iletisim' },
    ],
  },
  {
    title: 'Yardım',
    links: [
      { label: 'Kargo & Teslimat', href: '/iade-ve-teslimat' },
      { label: 'İade', href: '/iade-ve-teslimat' },
      { label: 'Mesafeli Satış Sözleşmesi', href: '/mesafeli-satis-sozlesmesi' },
      { label: 'Gizlilik Politikası', href: '/gizlilik-politikasi' },
      { label: 'KVKK', href: '/kvkk' },
    ],
  },
];

export function StorefrontFooter() {
  return (
    <footer className="bg-[var(--color-brand-ink)] text-[var(--color-brand-cream)] mt-24">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-16">
        {/* Newsletter */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h3 className="headline text-3xl md:text-4xl mb-4">Bültenimize Katılın</h3>
          <p className="text-[var(--color-brand-cream)]/70 mb-6 text-sm md:text-base">
            Yeni gelen ürünler, üretici hikayeleri ve özel kampanyalar.
          </p>
          <form className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <input
              type="email"
              required
              placeholder="E-posta adresiniz"
              className="flex-1 bg-transparent border border-[var(--color-brand-cream)]/30 px-4 py-3 text-sm placeholder:text-[var(--color-brand-cream)]/40 focus:outline-none focus:border-[var(--color-brand-cream)]"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-[var(--color-brand-cream)] text-[var(--color-brand-ink)] text-xs font-bold tracking-widest uppercase hover:opacity-90"
            >
              Katıl
            </button>
          </form>
        </div>

        <div className="hairline mb-12" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="bg-[var(--color-brand-cream)] inline-block p-3 rounded mb-4">
              <Logo width={120} />
            </div>
            <p className="text-sm text-[var(--color-brand-cream)]/70 leading-relaxed">
              Anadolu'nun küçük üreticilerini bir araya getiren pazaryeri.
              El yapımı, doğal, hikayesi olan ürünler.
            </p>
          </div>
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="text-xs font-bold tracking-widest uppercase mb-4 text-[var(--color-brand-cream)]/90">
                {group.title}
              </h4>
              <ul className="space-y-2.5 text-sm text-[var(--color-brand-cream)]/70">
                {group.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-[var(--color-brand-cream)] transition">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="hairline my-10" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[var(--color-brand-cream)]/50">
          <div>© {new Date().getFullYear()} Via Glocal Dış Tic. Ltd. Şti. — Tüm hakları saklıdır.</div>
          <div className="flex items-center gap-4">
            <span>Visa · Mastercard · Troy · Iyzico</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
