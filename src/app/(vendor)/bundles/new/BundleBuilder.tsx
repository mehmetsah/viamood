'use client';

import { useMemo, useState } from 'react';
import { createBundleAction } from '@/lib/actions/bundle';

interface Variant {
  variantId: string;
  title: string;
  sku: string;
  imageUrl?: string;
  priceCents: number;
  costCents: number | null;
  weightGrams: number | null;
  available: number;
}

interface Selected {
  variantId: string;
  quantity: number;
}

interface Props {
  variants: Variant[];
  isAdminMixed: boolean;
}

// Frontend tarafında shipping calc (server-side aynı)
const SHIPPING_BASE = 30_00;
const SHIPPING_PER_KG = 50_00;
function shipFor(weightGrams: number | null): number {
  if (!weightGrams || weightGrams <= 0) return SHIPPING_BASE;
  return SHIPPING_BASE + Math.round((weightGrams / 1000) * SHIPPING_PER_KG);
}

function formatTL(cents: number): string {
  return (cents / 100).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ₺';
}

function slugify(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i').replace(/[ğĞ]/g, 'g').replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's').replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function BundleBuilder({ variants, isAdminMixed }: Props) {
  const [selected, setSelected] = useState<Selected[]>([]);
  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [bundlePriceTL, setBundlePriceTL] = useState('');
  const [initialSetCount, setInitialSetCount] = useState('0');
  const [packageWeight, setPackageWeight] = useState('');
  const [packageL, setPackageL] = useState('');
  const [packageW, setPackageW] = useState('');
  const [packageH, setPackageH] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variantMap = useMemo(() => {
    const m = new Map<string, Variant>();
    for (const v of variants) m.set(v.variantId, v);
    return m;
  }, [variants]);

  const visibleVariants = useMemo(() => {
    if (!search.trim()) return variants;
    const q = search.toLocaleLowerCase('tr-TR');
    return variants.filter(
      (v) =>
        v.title.toLocaleLowerCase('tr-TR').includes(q) ||
        v.sku.toLocaleLowerCase('tr-TR').includes(q),
    );
  }, [variants, search]);

  // Hesaplar
  const metrics = useMemo(() => {
    let totalCost = 0;
    let normalPrice = 0;
    let individualShipping = 0;
    let totalWeight = 0;
    const components: Array<{
      v: Variant;
      qty: number;
      cost: number;
      cShare: number;
    }> = [];
    for (const s of selected) {
      const v = variantMap.get(s.variantId);
      if (!v) continue;
      const cost = (v.costCents ?? 0) * s.quantity;
      const price = v.priceCents * s.quantity;
      const ship = shipFor(v.weightGrams) * s.quantity;
      const weight = (v.weightGrams ?? 0) * s.quantity;
      totalCost += cost;
      normalPrice += price;
      individualShipping += ship;
      totalWeight += weight;
      components.push({ v, qty: s.quantity, cost, cShare: 0 });
    }
    // Cost share doldur
    for (const c of components) {
      c.cShare = totalCost > 0 ? c.cost / totalCost : 0;
    }
    const bundlePrice = Math.round(parseFloat(bundlePriceTL.replace(',', '.') || '0') * 100);
    const customWeight = packageWeight ? parseInt(packageWeight, 10) : totalWeight;
    const bundleShipping = shipFor(customWeight);
    const profitNormal = normalPrice - totalCost - individualShipping;
    const profitBundle = bundlePrice - totalCost - bundleShipping;
    return {
      components,
      totalCost,
      normalPrice,
      bundlePrice,
      discount: normalPrice - bundlePrice,
      discountPct: normalPrice > 0 ? ((normalPrice - bundlePrice) / normalPrice) * 100 : 0,
      individualShipping,
      bundleShipping,
      shippingSavings: individualShipping - bundleShipping,
      totalWeight,
      profitNormal,
      profitBundle,
      profitDiff: profitBundle - profitNormal,
    };
  }, [selected, variantMap, bundlePriceTL, packageWeight]);

  function addVariant(v: Variant) {
    if (selected.find((s) => s.variantId === v.variantId)) return;
    setSelected((prev) => [...prev, { variantId: v.variantId, quantity: 1 }]);
  }
  function removeVariant(variantId: string) {
    setSelected((prev) => prev.filter((s) => s.variantId !== variantId));
  }
  function updateQty(variantId: string, qty: number) {
    setSelected((prev) =>
      prev.map((s) => (s.variantId === variantId ? { ...s, quantity: Math.max(1, qty) } : s)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.length < 2) {
      setError('En az 2 farklı ürün eklemelisin');
      return;
    }
    if (!title.trim()) {
      setError('Set başlığı zorunlu');
      return;
    }
    if (metrics.bundlePrice <= 0) {
      setError('Set fiyatı 0\'dan büyük olmalı');
      return;
    }
    // Initial set stoğu kontrol
    const setCount = parseInt(initialSetCount, 10) || 0;
    if (setCount > 0) {
      for (const s of selected) {
        const v = variantMap.get(s.variantId)!;
        const needed = s.quantity * setCount;
        if (v.available < needed) {
          setError(`${v.title} stok yetersiz (${v.available} var, ${needed} gerek)`);
          return;
        }
      }
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.set('title', title);
    fd.set('sku', sku || slugify(title) + '-SET');
    fd.set('handle', slugify(title) + '-set');
    fd.set('description', description);
    fd.set('featuredImageUrl', imageUrl);
    fd.set('bundlePrice', bundlePriceTL);
    fd.set('initialSetCount', initialSetCount);
    if (packageWeight) fd.set('packageWeightGrams', packageWeight);
    if (packageL) fd.set('packageLengthCm', packageL);
    if (packageW) fd.set('packageWidthCm', packageW);
    if (packageH) fd.set('packageHeightCm', packageH);
    fd.set(
      'components',
      JSON.stringify(selected.map((s) => ({ variantId: s.variantId, quantity: s.quantity }))),
    );
    if (isAdminMixed) fd.set('isAdminMixed', '1');

    try {
      await createBundleAction(fd);
      // redirect içeride yapılıyor
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-6">
      {/* Sol: ürün seçimi */}
      <div className="lg:col-span-2 space-y-6">
        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-bold mb-4">1. Set Bilgileri</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold mb-1 block">Başlık *</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Örn: Mutfak Düzenleme Seti"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold mb-1 block">SKU (opsiyonel — boş = otomatik)</span>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="VEN-SET-001"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold mb-1 block">Açıklama</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold mb-1 block">Görsel URL</span>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-bold mb-4">2. Ürünleri Seç</h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün ara…"
            className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
            {visibleVariants.map((v) => {
              const isSelected = selected.find((s) => s.variantId === v.variantId);
              return (
                <button
                  type="button"
                  key={v.variantId}
                  onClick={() => addVariant(v)}
                  disabled={!!isSelected || v.available <= 0}
                  className={`text-left border rounded-lg p-2 text-xs ${
                    isSelected
                      ? 'bg-green-50 border-green-300'
                      : v.available <= 0
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:border-[var(--color-brand-orange)]'
                  }`}
                >
                  {v.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={v.imageUrl} alt="" className="aspect-square w-full object-cover rounded mb-1" />
                  ) : (
                    <div className="aspect-square w-full bg-neutral-100 rounded mb-1" />
                  )}
                  <div className="font-semibold line-clamp-2">{v.title}</div>
                  <div className="text-neutral-500">{formatTL(v.priceCents)} · Stok {v.available}</div>
                  {isSelected && <div className="text-green-700 font-bold mt-1">✓ Eklendi</div>}
                </button>
              );
            })}
          </div>
        </section>

        {selected.length > 0 && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="font-bold mb-4">3. Set İçeriği</h2>
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="pb-2">Ürün</th>
                  <th className="pb-2 text-right">Tekil Fiyat</th>
                  <th className="pb-2 text-right">Maliyet</th>
                  <th className="pb-2 text-right">Stok</th>
                  <th className="pb-2 text-center w-24">Adet</th>
                  <th className="pb-2 text-right">Set Maliyet</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selected.map((s) => {
                  const v = variantMap.get(s.variantId);
                  if (!v) return null;
                  return (
                    <tr key={s.variantId}>
                      <td className="py-3">
                        <div className="font-semibold">{v.title}</div>
                        <div className="text-xs text-neutral-500 font-mono">{v.sku}</div>
                      </td>
                      <td className="py-3 text-right font-mono">{formatTL(v.priceCents)}</td>
                      <td className="py-3 text-right font-mono text-neutral-600">
                        {v.costCents ? formatTL(v.costCents) : '—'}
                      </td>
                      <td className="py-3 text-right text-neutral-600">{v.available}</td>
                      <td className="py-3 text-center">
                        <input
                          type="number"
                          min={1}
                          value={s.quantity}
                          onChange={(e) => updateQty(s.variantId, parseInt(e.target.value) || 1)}
                          className="w-16 border rounded px-2 py-1 text-sm text-center"
                        />
                      </td>
                      <td className="py-3 text-right font-mono">
                        {v.costCents ? formatTL(v.costCents * s.quantity) : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeVariant(s.variantId)}
                          className="text-red-600 hover:underline text-xs"
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-bold mb-4">4. Fiyat & Set Kargo</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold mb-1 block">Set Fiyatı (TL) *</span>
              <input
                type="text"
                value={bundlePriceTL}
                onChange={(e) => setBundlePriceTL(e.target.value)}
                placeholder="299,99"
                required
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
              />
              {metrics.normalPrice > 0 && (
                <div className="text-xs text-neutral-500 mt-1">
                  Tekil toplam: <strong>{formatTL(metrics.normalPrice)}</strong>
                </div>
              )}
            </label>
            <label className="block">
              <span className="text-xs font-semibold mb-1 block">İlk Set Adedi (stoktan çekilecek)</span>
              <input
                type="number"
                min={0}
                value={initialSetCount}
                onChange={(e) => setInitialSetCount(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <div className="text-xs text-neutral-500 mt-1">0 girersen sonra "set hazırla" ile ekleyebilirsin</div>
            </label>
            <label className="block">
              <span className="text-xs font-semibold mb-1 block">Set Paket Ağırlığı (gram)</span>
              <input
                type="number"
                value={packageWeight}
                onChange={(e) => setPackageWeight(e.target.value)}
                placeholder={`Otomatik: ${metrics.totalWeight}g`}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold mb-1 block">Set Boyut (cm — UxGxY)</span>
              <div className="flex gap-2">
                <input type="number" placeholder="U" value={packageL} onChange={(e) => setPackageL(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <input type="number" placeholder="G" value={packageW} onChange={(e) => setPackageW(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <input type="number" placeholder="Y" value={packageH} onChange={(e) => setPackageH(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </label>
          </div>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
            ⚠ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || selected.length < 2 || !title || !bundlePriceTL}
          className="w-full py-4 bg-black text-white rounded-lg font-bold tracking-wider uppercase text-sm disabled:opacity-50"
        >
          {submitting ? 'Kaydediliyor…' : 'Set Yarat'}
        </button>
      </div>

      {/* Sağ: özet (sticky) */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section className="bg-[var(--color-brand-ink)] text-white rounded-xl p-6">
          <h3 className="font-bold mb-4">📊 Kar Analizi</h3>
          <div className="space-y-3 text-sm">
            <Row label="Toplam maliyet" value={formatTL(metrics.totalCost)} />
            <Row label="Tekil satış toplamı" value={formatTL(metrics.normalPrice)} />
            <Row label="Set satış fiyatı" value={formatTL(metrics.bundlePrice)} bold />
            {metrics.discount > 0 && (
              <Row label={`Müşteriye indirim (-%${metrics.discountPct.toFixed(0)})`} value={formatTL(metrics.discount)} negative />
            )}
            <div className="border-t border-white/20 my-2" />
            <Row label="Tekil kargo (toplam)" value={formatTL(metrics.individualShipping)} />
            <Row label="Set kargo" value={formatTL(metrics.bundleShipping)} />
            <Row label="Kargo tasarrufu" value={formatTL(metrics.shippingSavings)} positive={metrics.shippingSavings > 0} />
            <div className="border-t border-white/20 my-2" />
            <Row label="Tekil satış karı" value={formatTL(metrics.profitNormal)} />
            <Row label="Set satış karı" value={formatTL(metrics.profitBundle)} bold positive={metrics.profitBundle > 0} negative={metrics.profitBundle < 0} />
            <Row label="Fark" value={formatTL(metrics.profitDiff)} positive={metrics.profitDiff > 0} negative={metrics.profitDiff < 0} />
          </div>
        </section>

        {metrics.components.length > 0 && (
          <section className="bg-white rounded-xl border p-5">
            <h3 className="font-bold mb-3 text-sm">Komponent Kar Payı</h3>
            <p className="text-xs text-neutral-500 mb-3">
              Set karı maliyet oranına göre dağıtılır
            </p>
            <div className="space-y-2 text-xs">
              {metrics.components.map((c) => (
                <div key={c.v.variantId} className="flex justify-between gap-3">
                  <span className="truncate flex-1">
                    {c.v.title} × {c.qty}
                  </span>
                  <span className="text-neutral-500 shrink-0">%{(c.cShare * 100).toFixed(0)}</span>
                  <span className="font-mono shrink-0">
                    {formatTL(Math.round(metrics.profitBundle * c.cShare))}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>
    </form>
  );
}

function Row({
  label,
  value,
  bold,
  positive,
  negative,
}: {
  label: string;
  value: string;
  bold?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  const cls = positive ? 'text-green-300' : negative ? 'text-red-300' : '';
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-white/70 text-xs">{label}</span>
      <span className={`font-mono ${bold ? 'font-bold text-base' : ''} ${cls}`}>{value}</span>
    </div>
  );
}
