import { getStoreSettings } from '@/lib/settings/store';
import { updateStoreSettingsAction } from '@/lib/actions/settings';

interface PageProps {
  searchParams: Promise<{ saved?: string }>;
}

function Toggle({ name, label, hint, checked }: { name: string; label: string; hint?: string; checked?: boolean }) {
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-1 w-4 h-4 accent-[var(--color-brand-orange)]" />
      <span>
        <span className="font-medium text-sm">{label}</span>
        {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
      </span>
    </label>
  );
}

export default async function AdminSettingsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const s = await getStoreSettings();
  const inputCls =
    'h-10 w-full px-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-[var(--color-brand-orange)]';

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Ayarlar</h1>
      <p className="text-sm text-neutral-500 mb-6">Ödeme yöntemleri ve kargo — storefront checkout buradan beslenir.</p>

      {sp?.saved && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          ✓ Ayarlar kaydedildi
        </div>
      )}

      <form action={updateStoreSettingsAction} className="flex flex-col gap-6">
        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-bold border-b pb-2 mb-3">Ödeme yöntemleri</h2>
          <Toggle name="iyzico_enabled" label="İyzico (kredi/banka kartı)" checked={s.payment.iyzico_enabled} />
          <Toggle name="paytr_enabled" label="PayTR (kredi/banka kartı)" checked={s.payment.paytr_enabled} />
          <Toggle name="havale_enabled" label="Havale / EFT" checked={s.payment.havale_enabled} />
          <Toggle name="cod_enabled" label="Kapıda ödeme (COD)" hint="Kargocu kapıda nakit/kart tahsil eder" checked={s.payment.cod_enabled} />

          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div>
              <label className="text-sm font-medium block mb-1.5">Kart gateway’i</label>
              <select name="card_gateway" defaultValue={s.payment.card_gateway ?? 'iyzico'} className={inputCls}>
                <option value="iyzico">İyzico</option>
                <option value="paytr">PayTR</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">Kart ödemesi hangi sağlayıcıyla alınsın</p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Kapıda kart komisyonu (%)</label>
              <input type="number" step="0.1" min="0" name="cod_card_surcharge_pct" defaultValue={s.payment.cod_card_surcharge_pct ?? 4} className={inputCls} />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-bold border-b pb-2 mb-3">Kargo</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Ücretsiz kargo eşiği (TL)</label>
              <input type="number" min="0" name="free_shipping_threshold" placeholder="örn. 1500" defaultValue={s.shipping.free_shipping_threshold ?? ''} className={inputCls} />
              <p className="text-xs text-neutral-500 mt-1">Boş = ücretsiz kargo yok</p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Kargo marjı (TL)</label>
              <input type="number" min="0" name="shipping_margin_tl" defaultValue={s.shipping.shipping_margin_tl ?? 20} className={inputCls} />
              <p className="text-xs text-neutral-500 mt-1">KargoLab fiyatına eklenir</p>
            </div>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium block mb-1.5">Varsayılan kargo firması</label>
            <input name="default_courier" placeholder="örn. Aras Kargo" defaultValue={s.shipping.default_courier ?? ''} className={inputCls} />
          </div>
        </section>

        <button type="submit" className="self-end px-6 py-2.5 rounded-lg bg-[var(--color-brand-ink)] text-white font-semibold text-sm">
          Kaydet
        </button>
      </form>
    </div>
  );
}
