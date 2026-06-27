import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { getStoreSettings } from '@/lib/settings/store';
import { STOREFRONT_CSS } from './_theme';
import { CartCount } from './_home/CartCount';
import { MegaNav } from './_home/MegaNav';
import { SiteFooter } from './_home/SiteFooter';

/**
 * Müşteri vitrini (storefront) shell — viamood.com.tr teması (.emp). Header/footer + tema CSS.
 * Tema ayarları (renk/duyuru) /admin/theme'den yönetilir.
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { theme } = await getStoreSettings();
  const styleVars = {
    ...(theme.brand_primary ? { ['--color-brand-orange']: theme.brand_primary } : {}),
    ...(theme.brand_ink ? { ['--color-brand-ink']: theme.brand_ink } : {}),
  } as React.CSSProperties;
  const announcement =
    theme.announcement_enabled && theme.announcement
      ? theme.announcement
      : 'Türkiye genelinde kargo • Güvenli ödeme • Kapıda ödeme seçeneği';

  return (
    <div style={styleVars} className="emp min-h-screen flex flex-col">
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: STOREFRONT_CSS }} />

      <div className="emp-ann">{announcement}</div>

      <header className="emp-hd">
        <div className="emp-hd__row">
          <Link href="/" aria-label="Via Mood" style={{ display: 'flex', alignItems: 'center' }}><Logo width={78} /></Link>
          <MegaNav />
          <div className="emp-hd__actions">
            <Link href="/magaza" className="emp-hd__icon" aria-label="Ara">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            </Link>
            <Link href="/hesabim" className="emp-hd__icon" aria-label="Hesabım">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
              <span className="emp-hd__hide-sm">Hesabım</span>
            </Link>
            <CartCount />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <SiteFooter footerText={theme.footer_text} />
    </div>
  );
}
