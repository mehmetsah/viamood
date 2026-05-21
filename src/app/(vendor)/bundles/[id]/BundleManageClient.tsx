'use client';

import { useState, useTransition } from 'react';
import {
  archiveBundleAction,
  prepareBundleStockAction,
  pushBundleToShopifyAction,
  toggleBundleStatusAction,
  unprepareBundleStockAction,
} from '@/lib/actions/bundle';

interface Component {
  variantId: string;
  title: string;
  quantity: number;
  available: number;
}

interface Props {
  bundleId: string;
  currentStatus: string;
  currentInventory: number;
  isPushed: boolean;
  components: Component[];
}

export function BundleManageClient({
  bundleId,
  currentStatus,
  currentInventory,
  isPushed,
  components,
}: Props) {
  const [setCount, setSetCount] = useState('1');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Hazırlanabilecek max set adedi (en az olan komponentin bottleneck'ine bağlı)
  const maxPossible = Math.min(
    ...components.map((c) => Math.floor(c.available / c.quantity)),
  );

  function showMsg(kind: 'ok' | 'err', text: string) {
    setMessage({ kind, text });
    setTimeout(() => setMessage(null), 5000);
  }

  function handlePrepare() {
    const n = parseInt(setCount, 10) || 0;
    if (n <= 0) return showMsg('err', 'En az 1 set');
    if (n > maxPossible) return showMsg('err', `Max ${maxPossible} set hazırlanabilir`);

    const fd = new FormData();
    fd.set('bundleId', bundleId);
    fd.set('setCount', String(n));
    startTransition(async () => {
      const res = await prepareBundleStockAction(fd);
      if (res.success) showMsg('ok', `${n} set hazırlandı`);
      else showMsg('err', res.error ?? 'Hata');
    });
  }

  function handleUnprepare() {
    const n = parseInt(setCount, 10) || 0;
    if (n <= 0) return showMsg('err', 'En az 1 set');
    if (n > currentInventory) return showMsg('err', `Sadece ${currentInventory} set mevcut`);

    const fd = new FormData();
    fd.set('bundleId', bundleId);
    fd.set('setCount', String(n));
    startTransition(async () => {
      const res = await unprepareBundleStockAction(fd);
      if (res.success) showMsg('ok', `${n} set bozuldu, komponentlere geri eklendi`);
      else showMsg('err', res.error ?? 'Hata');
    });
  }

  function handlePush() {
    const fd = new FormData();
    fd.set('bundleId', bundleId);
    startTransition(async () => {
      const res = await pushBundleToShopifyAction(fd);
      if (res.success) showMsg('ok', 'Shopify\'a gönderildi / güncellendi');
      else showMsg('err', res.error ?? 'Shopify push hatası');
    });
  }

  return (
    <div className="space-y-6">
      {/* Stok yönetimi */}
      <section className="bg-white rounded-xl border p-6">
        <h2 className="font-bold mb-1">🎁 Stok Hazırla / Boz</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Set hazırla → komponentlerden düşürür. Set boz → komponentlere geri ekler.
          <br />
          Mevcut set sayısı: <strong>{currentInventory}</strong> · Maksimum hazırlanabilir:{' '}
          <strong>{maxPossible}</strong>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-sm">Adet:</span>
            <input
              type="number"
              min={1}
              value={setCount}
              onChange={(e) => setSetCount(e.target.value)}
              className="w-20 border rounded px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={handlePrepare}
            disabled={pending || maxPossible <= 0}
            className="px-4 py-2 bg-[var(--color-brand-ink)] text-white rounded-lg font-semibold text-sm disabled:opacity-50"
          >
            ✓ Set hazırla
          </button>
          <button
            type="button"
            onClick={handleUnprepare}
            disabled={pending || currentInventory <= 0}
            className="px-4 py-2 border rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-neutral-50"
          >
            ↶ Set boz
          </button>
        </div>
        {message && (
          <p
            className={`mt-3 text-sm rounded px-3 py-2 ${
              message.kind === 'ok'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {message.kind === 'ok' ? '✓' : '⚠'} {message.text}
          </p>
        )}
      </section>

      {/* Status toggle */}
      <section className="bg-white rounded-xl border p-6">
        <h2 className="font-bold mb-2">🚀 Yayın Durumu</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Yayında olan setler storefront ve Shopify'da görünür.
        </p>
        <form action={toggleBundleStatusAction} className="flex items-center gap-3">
          <input type="hidden" name="bundleId" value={bundleId} />
          {currentStatus === 'draft' ? (
            <>
              <input type="hidden" name="status" value="active" />
              <button
                type="submit"
                disabled={currentInventory <= 0}
                className="px-5 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50"
              >
                Yayına Al
              </button>
              {currentInventory <= 0 && (
                <span className="text-xs text-neutral-500">Yayına almak için en az 1 set hazırla</span>
              )}
            </>
          ) : currentStatus === 'active' ? (
            <>
              <input type="hidden" name="status" value="draft" />
              <button
                type="submit"
                className="px-5 py-2 bg-neutral-800 text-white rounded-lg font-semibold text-sm"
              >
                Taslağa Çek
              </button>
            </>
          ) : (
            <span className="text-sm text-neutral-500">Arşivlenmiş</span>
          )}
        </form>

        <div className="mt-4 pt-4 border-t flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handlePush}
            disabled={pending || currentInventory <= 0}
            className="px-4 py-2 border border-[var(--color-brand-ink)] text-[var(--color-brand-ink)] rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-neutral-50"
          >
            🛒 {isPushed ? 'Shopify\'da Güncelle' : 'Shopify\'a Push'}
          </button>
          {isPushed ? (
            <span className="text-xs text-green-700">✓ Shopify'a push edildi</span>
          ) : (
            <span className="text-xs text-neutral-500">
              Yayına aldığında otomatik push olur — manuel de tetikleyebilirsin
            </span>
          )}
        </div>
      </section>

      {/* Arşivle */}
      <section className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="font-bold text-red-700 mb-2">Tehlikeli Alan</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Arşivlenince mevcut set stoğu komponentlere geri yansıtılır, set storefront'tan kalkar.
        </p>
        <form
          action={archiveBundleAction}
          onSubmit={(e) => {
            if (!confirm('Bu seti arşivlemek istediğine emin misin?')) e.preventDefault();
          }}
        >
          <input type="hidden" name="bundleId" value={bundleId} />
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700"
          >
            Seti Arşivle
          </button>
        </form>
      </section>
    </div>
  );
}
