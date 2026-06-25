import Link from 'next/link';
import { getStoreSettings } from '@/lib/settings/store';
import { saveThemeAction } from '@/lib/actions/settings';

interface PageProps {
  searchParams: Promise<{ saved?: string }>;
}

export default async function AdminThemePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { theme } = await getStoreSettings();
  const inputCls =
    'h-11 w-full px-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-[var(--color-brand-orange)]';
  const label = 'text-sm font-medium block mb-1.5';

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-3xl font-bold">Tema Editörü</h1>
        <Link href="/magaza" target="_blank" className="text-sm px-4 py-2 rounded-lg border hover:bg-neutral-50">
          Vitrini önizle ↗
        </Link>
      </div>
      <p className="text-sm text-neutral-500 mb-6">Storefront görünümünü buradan ayarla — kaydedince vitrine yansır.</p>

      {sp?.saved && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          ✓ Tema kaydedildi — <Link href="/magaza" target="_blank" className="underline">vitrini aç</Link>
        </div>
      )}

      <form action={saveThemeAction} className="flex flex-col gap-6">
        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-bold border-b pb-2 mb-4">Marka renkleri</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Vurgu rengi (buton/fiyat)</label>
              <input type="color" name="brand_primary" defaultValue={theme.brand_primary || '#e1691f'} className="h-11 w-full rounded-lg border border-neutral-300" />
            </div>
            <div>
              <label className={label}>Koyu renk (header/footer)</label>
              <input type="color" name="brand_ink" defaultValue={theme.brand_ink || '#14201d'} className="h-11 w-full rounded-lg border border-neutral-300" />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-bold border-b pb-2 mb-4">Duyuru çubuğu</h2>
          <label className="flex items-center gap-2 text-sm font-medium mb-3 cursor-pointer">
            <input type="checkbox" name="announcement_enabled" defaultChecked={theme.announcement_enabled} className="w-4 h-4 accent-[var(--color-brand-orange)]" />
            Üst duyuru çubuğunu göster
          </label>
          <input name="announcement" defaultValue={theme.announcement ?? ''} placeholder="Örn: 1500₺ üzeri kargo bedava 🚚" className={inputCls} />
        </section>

        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-bold border-b pb-2 mb-4">Hero banner (katalog üstü)</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className={label}>Başlık</label>
              <input name="hero_title" defaultValue={theme.hero_title ?? ''} placeholder="Mutfağına değer kat" className={inputCls} />
            </div>
            <div>
              <label className={label}>Alt başlık</label>
              <input name="hero_subtitle" defaultValue={theme.hero_subtitle ?? ''} placeholder="Seçkin mutfak ürünleri, hızlı kargo" className={inputCls} />
            </div>
            <div>
              <label className={label}>Görsel URL</label>
              <input name="hero_image" defaultValue={theme.hero_image ?? ''} placeholder="https://…" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Buton metni</label>
                <input name="hero_cta_text" defaultValue={theme.hero_cta_text ?? ''} placeholder="Alışverişe başla" className={inputCls} />
              </div>
              <div>
                <label className={label}>Buton linki</label>
                <input name="hero_cta_link" defaultValue={theme.hero_cta_link ?? '/magaza'} placeholder="/magaza" className={inputCls} />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-bold border-b pb-2 mb-4">Footer</h2>
          <input name="footer_text" defaultValue={theme.footer_text ?? ''} placeholder="© Via Mood — tüm hakları saklıdır" className={inputCls} />
        </section>

        <button type="submit" className="self-end px-6 py-2.5 rounded-lg bg-[var(--color-brand-ink)] text-white font-semibold text-sm">
          Temayı Kaydet
        </button>
      </form>
    </div>
  );
}
