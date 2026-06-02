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

// Shipping helpers
const SHIPPING_BASE = 30_00;         // 30 TL base
const SHIPPING_PER_KG = 50_00;       // 50 TL per kg
const DIM_DIVISOR = 5000;            // Standard volumetric: cm³ / 5000 = kg

function shipFor(weightGrams: number | null): number {
  if (!weightGrams || weightGrams <= 0) return SHIPPING_BASE;
  return SHIPPING_BASE + Math.round((weightGrams / 1000) * SHIPPING_PER_KG);
}

/**
 * Kargolab-style desi/volumetric: max(actual weight, dim weight)
 * dim_weight_g = (L × W × H cm³) / 5 (= /5000 × 1000)
 */
function kargolabShipping(weightGrams: number, L: number, W: number, H: number): { effectiveKg: number; tl: number; basis: 'actual' | 'dimensional' } {
  const actualKg = weightGrams / 1000;
  const dimKg = (L > 0 && W > 0 && H > 0) ? (L * W * H) / DIM_DIVISOR : 0;
  const effectiveKg = Math.max(actualKg, dimKg);
  const tl = SHIPPING_BASE + Math.round(effectiveKg * SHIPPING_PER_KG);
  return {
    effectiveKg: Math.round(effectiveKg * 100) / 100,
    tl,
    basis: dimKg > actualKg ? 'dimensional' : 'actual',
  };
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

  // Per-line + aggregate metrics
  const metrics = useMemo(() => {
    let totalCost = 0;
    let normalPrice = 0;
    let individualShipping = 0;
    let totalWeight = 0;
    const lines: Array<{
      v: Variant;
      qty: number;
      lineCost: number;          // maliyet × qty
      linePrice: number;         // satış × qty
      lineShipping: number;      // tekil kargo × qty
      lineProfit: number;        // tekil satış kar (satış - maliyet - kargo) × qty
      cShare: number;            // maliyet payı %
      setProfitShare: number;    // set kar dağıtımı (sonradan doldurulur)
    }> = [];
    for (const s of selected) {
      const v = variantMap.get(s.variantId);
      if (!v) continue;
      const cost = (v.costCents ?? 0) * s.quantity;
      const price = v.priceCents * s.quantity;
      const ship = shipFor(v.weightGrams) * s.quantity;
      const weight = (v.weightGrams ?? 0) * s.quantity;
      const profit = price - cost - ship;
      totalCost += cost;
      normalPrice += price;
      individualShipping += ship;
      totalWeight += weight;
      lines.push({ v, qty: s.quantity, lineCost: cost, linePrice: price, lineShipping: ship, lineProfit: profit, cShare: 0, setProfitShare: 0 });
    }
    // Cost share %
    for (const l of lines) {
      l.cShare = totalCost > 0 ? l.lineCost / totalCost : 0;
    }
    const bundlePrice = Math.round(parseFloat(bundlePriceTL.replace(',', '.') || '0') * 100);

    // Kargolab-style: max(actual, dimensional)
    const customWeight = packageWeight ? parseInt(packageWeight, 10) : totalWeight;
    const L = parseFloat(packageL) || 0;
    const W = parseFloat(packageW) || 0;
    const H = parseFloat(packageH) || 0;
    const kargolab = kargolabShipping(customWeight, L, W, H);
    const bundleShipping = kargolab.tl;
    const profitNormal = normalPrice - totalCost - individualShipping;
    const profitBundle = bundlePrice - totalCost - bundleShipping;
    // Set kar dağıt
    for (const l of lines) {
      l.setProfitShare = Math.round(profitBundle * l.cShare);
    }
    return {
      lines,
      totalCost,
      normalPrice,
      bundlePrice,
      discount: normalPrice - bundlePrice,
      discountPct: normalPrice > 0 ? ((normalPrice - bundlePrice) / normalPrice) * 100 : 0,
      individualShipping,
      bundleShipping,
      shippingSavings: individualShipping - bundleShipping,
      totalWeight,
      kargolab,
      profitNormal,
      profitBundle,
      profitDiff: profitBundle - profitNormal,
    };
  }, [selected, variantMap, bundlePriceTL, packageWeight, packageL, packageW, packageH]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-6">
      {/* ============ SOL: form ============ */}
      <div className="lg:col-span-2 space-y-6">
        {/* 1. Set Bilgileri */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-bold mb-4">1. Set Bilgileri</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold mb-1 block">Başlık *</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Mutfak Düzenleme Seti" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold mb-1 block">SKU (opsiyonel — boş = otomatik)</span>
              <input type="text" value={sku} onChange={(e) => setSku(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="VEN-SET-001" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold mb-1 block">Açıklama</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold mb-1 block">Görsel URL</span>
              <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..." className="w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
          </div>
        </section>

        {/* 2. Ürün Seç */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-bold mb-4">2. Ürünleri Seç</h2>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün ara…" className="w-full border rounded-lg px-3 py-2 text-sm mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
            {visibleVariants.map((v) => {
              const isSelected = selected.find((s) => s.variantId === v.variantId);
              return (
                <button type="button" key={v.variantId} onClick={() => addVariant(v)}
                  disabled={!!isSelected || v.available <= 0}
                  className={`text-left border rounded-lg p-2 text-xs ${
                    isSelected ? 'bg-green-50 border-green-300'
                      : v.available <= 0 ? 'opacity-40 cursor-not-allowed'
                        : 'hover:border-[var(--color-brand-orange)]'
                  }`}>
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

        {/* 3. Set İçeriği — ZENGİN tablo (tüm kolonlar burada) */}
        {selected.length > 0 && (
          <section className="bg-white rounded-xl border overflow-hidden">
            <div className="p-6 pb-4">
              <h2 className="font-bold mb-1">3. Set İçeriği — Maliyet, Kargo & Kar</h2>
              <p className="text-xs text-neutral-500">Set kar maliyet oranına göre dağıtılır. Sete giren her ürün adedi, hazırlama sırasında stoktan düşürülür.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-y">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
                    <th className="p-3">Ürün</th>
                    <th className="p-3 text-right">Tekil Satış</th>
                    <th className="p-3 text-right">Maliyet</th>
                    <th className="p-3 text-right">Tekil Kargo</th>
                    <th className="p-3 text-right">Tekil Kar</th>
                    <th className="p-3 text-center w-20">Stok</th>
                    <th className="p-3 text-center w-20">Adet</th>
                    <th className="p-3 text-right">Set'te Maliyet</th>
                    <th className="p-3 text-right">Set Kar Payı</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {metrics.lines.map((l) => {
                    const unitShip = shipFor(l.v.weightGrams);
                    const unitProfit = l.v.priceCents - (l.v.costCents ?? 0) - unitShip;
                    return (
                      <tr key={l.v.variantId} className="hover:bg-neutral-50">
                        <td className="p-3">
                          <div className="font-semibold text-xs">{l.v.title}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">{l.v.sku}</div>
                        </td>
                        <td className="p-3 text-right font-mono text-xs">{formatTL(l.v.priceCents)}</td>
                        <td className="p-3 text-right font-mono text-xs text-neutral-700">
                          {l.v.costCents ? formatTL(l.v.costCents) : <span className="text-red-500">—</span>}
                        </td>
                        <td className="p-3 text-right font-mono text-xs text-neutral-600">{formatTL(unitShip)}</td>
                        <td className={`p-3 text-right font-mono text-xs font-semibold ${unitProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatTL(unitProfit)}
                        </td>
                        <td className="p-3 text-center text-xs text-neutral-600">{l.v.available}</td>
                        <td className="p-3 text-center">
                          <input type="number" min={1} value={l.qty}
                            onChange={(e) => updateQty(l.v.variantId, parseInt(e.target.value) || 1)}
                            className="w-14 border rounded px-1 py-1 text-xs text-center font-mono" />
                        </td>
                        <td className="p-3 text-right font-mono text-xs font-semibold">
                          {l.v.costCents ? formatTL(l.lineCost) : '—'}
                        </td>
                        <td className={`p-3 text-right font-mono text-xs font-bold ${metrics.profitBundle >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatTL(l.setProfitShare)}
                          <div className="text-[9px] text-neutral-500 font-normal">%{(l.cShare * 100).toFixed(0)}</div>
                        </td>
                        <td className="p-3 text-right">
                          <button type="button" onClick={() => removeVariant(l.v.variantId)}
                            className="text-red-600 hover:underline text-[10px] uppercase tracking-wide">Sil</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-neutral-50 border-t">
                  <tr className="text-xs font-semibold">
                    <td className="p-3" colSpan={2}>TOPLAM</td>
                    <td className="p-3 text-right font-mono">{formatTL(metrics.totalCost)}</td>
                    <td className="p-3 text-right font-mono">{formatTL(metrics.individualShipping)}</td>
                    <td className={`p-3 text-right font-mono ${metrics.profitNormal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatTL(metrics.profitNormal)}
                    </td>
                    <td colSpan={2}></td>
                    <td className="p-3 text-right font-mono">{formatTL(metrics.totalCost)}</td>
                    <td className={`p-3 text-right font-mono ${metrics.profitBundle >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatTL(metrics.profitBundle)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* 4. Fiyat & Set Kargo — Kargolab dim weight hesabıyla */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-bold mb-4">4. Fiyat & Set Kargo</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold mb-1 block">Set Fiyatı (TL) *</span>
              <input type="text" value={bundlePriceTL} onChange={(e) => setBundlePriceTL(e.target.value)}
                placeholder="299,99" required
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              {metrics.normalPrice > 0 && (
                <div className="text-xs text-neutral-500 mt-1">
                  Tekil toplam: <strong>{formatTL(metrics.normalPrice)}</strong>
                  {metrics.discount > 0 && (
                    <> · İndirim: <strong className="text-orange-700">%{metrics.discountPct.toFixed(0)} ({formatTL(metrics.discount)})</strong></>
                  )}
                </div>
              )}
            </label>
            <label className="block">
              <span className="text-xs font-semibold mb-1 block">İlk Set Adedi (stoktan çekilecek)</span>
              <input type="number" min={0} value={initialSetCount}
                onChange={(e) => setInitialSetCount(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="text-xs text-neutral-500 mt-1">
                0 = sonra "set hazırla" ile ekleyebilirsin · Ör. 5 set yaratılırsa her komponentin {' '}
                <strong>(adet × 5)</strong> kadar stoğu düşer
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-semibold mb-1 block">Set Paket Ağırlığı (gram)</span>
              <input type="number" value={packageWeight} onChange={(e) => setPackageWeight(e.target.value)}
                placeholder={`Otomatik: ${metrics.totalWeight}g`}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold mb-1 block">Set Boyut (cm — UxGxY)</span>
              <div className="flex gap-2">
                <input type="number" placeholder="U" value={packageL} onChange={(e) => setPackageL(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                <input type="number" placeholder="G" value={packageW} onChange={(e) => setPackageW(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                <input type="number" placeholder="Y" value={packageH} onChange={(e) => setPackageH(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
            </label>
          </div>

          {/* Kargolab dim weight kısa rapor — formun içinde */}
          {selected.length > 0 && (
            <div className="mt-4 grid md:grid-cols-3 gap-3 text-xs">
              <div className="bg-neutral-50 border rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">Tekil Kargo Toplam</div>
                <div className="font-mono font-bold">{formatTL(metrics.individualShipping)}</div>
                <div className="text-[10px] text-neutral-500 mt-1">{metrics.lines.length} parça ayrı kargo</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide text-blue-700 mb-1">Set Kargo (Kargolab)</div>
                <div className="font-mono font-bold text-blue-900">{formatTL(metrics.bundleShipping)}</div>
                <div className="text-[10px] text-blue-700 mt-1">
                  Etkin: {metrics.kargolab.effectiveKg} kg ({metrics.kargolab.basis === 'dimensional' ? 'desi' : 'fiziksel'})
                </div>
              </div>
              <div className={`border rounded-lg p-3 ${metrics.shippingSavings > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-[10px] uppercase tracking-wide text-neutral-700 mb-1">Kargo Tasarrufu</div>
                <div className={`font-mono font-bold ${metrics.shippingSavings > 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {metrics.shippingSavings >= 0 ? '+' : ''}{formatTL(metrics.shippingSavings)}
                </div>
                <div className="text-[10px] text-neutral-500 mt-1">tekil − set</div>
              </div>
            </div>
          )}
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
            ⚠ {error}
          </div>
        )}

        <button type="submit"
          disabled={submitting || selected.length < 2 || !title || !bundlePriceTL}
          className="w-full py-4 bg-black text-white rounded-lg font-bold tracking-wider uppercase text-sm disabled:opacity-50">
          {submitting ? 'Kaydediliyor…' : 'Set Yarat'}
        </button>
      </div>

      {/* ============ SAĞ: kısa final özet (sticky) ============ */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section className="bg-[var(--color-brand-ink)] text-white rounded-xl p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">📊 Final Kar Analizi</h3>
          {selected.length === 0 ? (
            <p className="text-xs text-white/60">Ürün ekleyince hesap görünür.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <Row label="Toplam maliyet" value={formatTL(metrics.totalCost)} />
              <Row label="Tekil satış toplamı" value={formatTL(metrics.normalPrice)} />
              <Row label="Set satış fiyatı" value={formatTL(metrics.bundlePrice)} bold />
              {metrics.discount > 0 && (
                <Row label={`Müşteri indirimi (-%${metrics.discountPct.toFixed(0)})`} value={formatTL(metrics.discount)} negative />
              )}
              <div className="border-t border-white/20 my-2" />
              <Row label="Tekil kargo (toplam)" value={formatTL(metrics.individualShipping)} />
              <Row label="Set kargo (Kargolab)" value={formatTL(metrics.bundleShipping)} />
              <Row label="Kargo tasarrufu" value={formatTL(metrics.shippingSavings)} positive={metrics.shippingSavings > 0} negative={metrics.shippingSavings < 0} />
              <div className="border-t border-white/20 my-2" />
              <Row label="Tekil satış karı" value={formatTL(metrics.profitNormal)} positive={metrics.profitNormal > 0} negative={metrics.profitNormal < 0} />
              <Row label="Set satış karı" value={formatTL(metrics.profitBundle)} bold positive={metrics.profitBundle > 0} negative={metrics.profitBundle < 0} />
              <div className="bg-white/10 rounded-lg p-3 mt-3">
                <div className="text-[10px] uppercase tracking-wide text-white/70 mb-1">Set vs Tekil Fark</div>
                <div className={`font-mono font-bold text-lg ${metrics.profitDiff >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {metrics.profitDiff >= 0 ? '+' : ''}{formatTL(metrics.profitDiff)}
                </div>
              </div>
            </div>
          )}
        </section>
      </aside>
    </form>
  );
}

function Row({
  label, value, bold, positive, negative,
}: { label: string; value: string; bold?: boolean; positive?: boolean; negative?: boolean }) {
  const cls = positive ? 'text-green-300' : negative ? 'text-red-300' : '';
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-white/70 text-xs">{label}</span>
      <span className={`font-mono ${bold ? 'font-bold text-base' : ''} ${cls}`}>{value}</span>
    </div>
  );
}
