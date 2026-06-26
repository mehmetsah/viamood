import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { getStoreSettings } from '@/lib/settings/store';

/**
 * Müşteri vitrini (storefront) shell — admin/vendor panelinden bağımsız.
 * Tema ayarları (renk/duyuru/footer) /admin/theme'den yönetilir, burada yansır.
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { theme } = await getStoreSettings();
  const styleVars = {
    ...(theme.brand_primary ? { ['--color-brand-orange']: theme.brand_primary } : {}),
    ...(theme.brand_ink ? { ['--color-brand-ink']: theme.brand_ink } : {}),
  } as React.CSSProperties;

  return (
    <div style={styleVars} className="min-h-screen bg-[var(--color-brand-cream,#faf6ec)] flex flex-col">
      {theme.announcement_enabled && theme.announcement && (
        <div className="bg-[var(--color-brand-ink)] text-white text-center text-sm py-2 px-4">
          {theme.announcement}
        </div>
      )}

      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
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
          <span>{theme.footer_text || `© ${new Date().getFullYear()} Via Mood`}</span>
          <div className="flex flex-wrap gap-5">
            <Link href="/magaza" className="hover:underline">Ürünler</Link>
            <Link href="/hesabim" className="hover:underline">Siparişlerim</Link>
            <Link href="/auth/sign-in" className="hover:underline text-neutral-400">Operatör Girişi</Link>
            <Link href="/auth/sign-up" className="hover:underline text-neutral-400">Tedarikçi Başvurusu</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
