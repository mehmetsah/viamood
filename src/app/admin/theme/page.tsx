import Link from 'next/link';
import { getStoreSettings } from '@/lib/settings/store';
import { saveThemeAction } from '@/lib/actions/settings';
import { resolveHomeSections } from '@/lib/storefront/sections';
import { SectionEditor } from './SectionEditor';

interface PageProps {
  searchParams: Promise<{ saved?: string }>;
}

export default async function AdminThemePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { theme } = await getStoreSettings();
  const sections = resolveHomeSections((theme as { homeSections?: unknown }).homeSections);
  const inputCls = 'h-10 w-full px-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-orange-500';
  const label = 'text-xs font-medium block mb-1 text-neutral-600';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Tema Editörü</h1>
          <p className="text-sm text-neutral-500">Anasayfa bölümlerini sırala, göster/gizle, düzenle — kaydedince vitrine yansır.</p>
        </div>
        <Link href="/" target="_blank" className="text-sm px-4 py-2 rounded-lg border hover:bg-neutral-50">Vitrini aç ↗</Link>
      </div>

      {sp?.saved && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-700">✓ Genel ayarlar kaydedildi</div>
      )}

      <details className="mb-4 bg-white rounded-xl border">
        <summary className="px-4 py-3 cursor-pointer font-semibold text-sm select-none">⚙️ Genel ayarlar (marka renkleri · duyuru çubuğu · footer)</summary>
        <form action={saveThemeAction} className="p-4 pt-0 grid sm:grid-cols-2 gap-4 border-t">
          <div>
            <label className={label}>Vurgu rengi</label>
            <input type="color" name="brand_primary" defaultValue={theme.brand_primary || '#f25334'} className="h-10 w-full rounded-lg border border-neutral-300" />
          </div>
          <div>
            <label className={label}>Koyu renk (header/footer)</label>
            <input type="color" name="brand_ink" defaultValue={theme.brand_ink || '#14201d'} className="h-10 w-full rounded-lg border border-neutral-300" />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium mb-1.5 cursor-pointer">
              <input type="checkbox" name="announcement_enabled" defaultChecked={theme.announcement_enabled} className="w-4 h-4 accent-orange-500" /> Duyuru çubuğunu göster
            </label>
            <input name="announcement" defaultValue={theme.announcement ?? ''} placeholder="Türkiye genelinde kargo • Güvenli ödeme • Kapıda ödeme" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Footer telif metni</label>
            <input name="footer_text" defaultValue={theme.footer_text ?? ''} placeholder="© 2026 Via Mood — tüm hakları saklıdır" className={inputCls} />
          </div>
          {/* hero alanları SectionEditor'da; eski alanları korumak için gizli geçir */}
          <input type="hidden" name="hero_title" defaultValue={theme.hero_title ?? ''} />
          <input type="hidden" name="hero_subtitle" defaultValue={theme.hero_subtitle ?? ''} />
          <input type="hidden" name="hero_image" defaultValue={theme.hero_image ?? ''} />
          <input type="hidden" name="hero_cta_text" defaultValue={theme.hero_cta_text ?? ''} />
          <input type="hidden" name="hero_cta_link" defaultValue={theme.hero_cta_link ?? ''} />
          <button type="submit" className="sm:col-span-2 justify-self-end px-5 py-2 rounded-lg bg-[var(--color-brand-ink,#14201d)] text-white font-medium text-sm">Genel ayarları kaydet</button>
        </form>
      </details>

      <SectionEditor initial={sections} />
    </div>
  );
}
