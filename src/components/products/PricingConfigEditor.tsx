'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  calculateInstagram,
  calculateTrendyol,
  excludeVat,
  suggestSalePrice,
} from '@/lib/calc/price-calculator';
import { updateVariantPricingAction } from '@/lib/actions/product';
import type { PricingConfig } from '@/db/schema/products';

interface Props {
  variantId: string;
  current: PricingConfig;
}

function n(v: string): number | undefined {
  if (v === '' || v == null) return undefined;
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : undefined;
}
function s(v: number | undefined): string {
  return v == null ? '' : String(v);
}
function fmtTL(x: number): string {
  return x.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}
function fmtPct(x: number): string {
  return x.toFixed(1) + '%';
}

export function PricingConfigEditor({ variantId, current }: Props) {
  // Form state — controlled inputs (string'ler)
  const [purchaseInc, setPurchaseInc] = useState(s(current.purchasePriceInclVat));
  const [purchaseExc, setPurchaseExc] = useState(s(current.purchasePriceExclVat));
  const [vat, setVat] = useState(s(current.vatPct ?? 20));
  const [desi, setDesi] = useState(s(current.desi));
  const [packaging, setPackaging] = useState(s(current.packagingCost));
  const [advertising, setAdvertising] = useState(s(current.advertisingCost));
  const [target, setTarget] = useState(s(current.targetProfitPct ?? 25));
  const [tySale, setTySale] = useState(s(current.trendyolPrice));
  const [tyCommBase, setTyCommBase] = useState(s(current.trendyolCommissionBase));
  const [tyCommPct, setTyCommPct] = useState(s(current.trendyolCommissionPct));
  const [payment, setPayment] = useState(s(current.paymentServicePct ?? 2.85));
  const [tyKargo, setTyKargo] = useState(s(current.trendyolKargoOverride));
  const [igSale, setIgSale] = useState(s(current.instagramPrice));
  const [pttKargo, setPttKargo] = useState(s(current.pttKargoOverride));

  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Eğer KDVli girilirse KDVsiz otomatik hesaplansın (auto-sync)
  const purchaseExclVatComputed = useMemo(() => {
    const inc = n(purchaseInc);
    const exc = n(purchaseExc);
    if (exc != null) return exc;
    if (inc != null) return excludeVat(inc, n(vat) ?? 20);
    return 0;
  }, [purchaseInc, purchaseExc, vat]);

  // Trendyol calc
  const trendyolOutput = useMemo(() => {
    const sale = n(tySale);
    if (!sale || purchaseExclVatComputed <= 0) return null;
    return calculateTrendyol({
      purchasePriceExclVat: purchaseExclVatComputed,
      vatPct: n(vat) ?? 20,
      desi: n(desi) ?? 0,
      salePriceInclVat: sale,
      commissionBasePriceInclVat: n(tyCommBase),
      commissionPct: n(tyCommPct) ?? 18,
      paymentServicePct: n(payment) ?? 2.85,
      advertisingCost: n(advertising) ?? 0,
      packagingCost: n(packaging) ?? 0,
      kargoOverride: n(tyKargo),
    });
  }, [tySale, purchaseExclVatComputed, vat, desi, tyCommBase, tyCommPct, payment, advertising, packaging, tyKargo]);

  // Instagram calc
  const igOutput = useMemo(() => {
    const sale = n(igSale);
    if (!sale || purchaseExclVatComputed <= 0) return null;
    return calculateInstagram({
      purchasePriceExclVat: purchaseExclVatComputed,
      vatPct: n(vat) ?? 20,
      desi: n(desi) ?? 0,
      salePriceInclVat: sale,
      advertisingCost: n(advertising) ?? 0,
      packagingCost: n(packaging) ?? 0,
      pttKargoInclVatOverride: n(pttKargo),
    });
  }, [igSale, purchaseExclVatComputed, vat, desi, advertising, packaging, pttKargo]);

  // Önerilen fiyatlar
  const suggested = useMemo(() => {
    if (purchaseExclVatComputed <= 0) return null;
    const t = n(target) ?? 25;
    return {
      ty: suggestSalePrice({
        channel: 'trendyol',
        purchasePriceExclVat: purchaseExclVatComputed,
        vatPct: n(vat) ?? 20,
        desi: n(desi) ?? 0,
        targetProfitPct: t,
        commissionPct: n(tyCommPct) ?? 18,
        paymentServicePct: n(payment) ?? 2.85,
        advertisingCost: n(advertising) ?? 0,
        packagingCost: n(packaging) ?? 0,
      }),
      ig: suggestSalePrice({
        channel: 'instagram',
        purchasePriceExclVat: purchaseExclVatComputed,
        vatPct: n(vat) ?? 20,
        desi: n(desi) ?? 0,
        targetProfitPct: t,
        advertisingCost: n(advertising) ?? 0,
        packagingCost: n(packaging) ?? 0,
      }),
    };
  }, [purchaseExclVatComputed, target, vat, desi, tyCommPct, payment, advertising, packaging]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateVariantPricingAction(variantId, fd);
      if (res.success) {
        setMsg({ kind: 'ok', text: 'Fiyatlandırma kaydedildi' });
      } else {
        setMsg({ kind: 'err', text: res.error ?? 'Hata' });
      }
      setTimeout(() => setMsg(null), 4000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* SOL — INPUTS */}
      <div className="lg:col-span-1 space-y-4">
        <section className="bg-white rounded-xl border p-5">
          <h3 className="font-bold mb-4 text-sm">📦 Maliyet & Ürün</h3>
          <div className="space-y-3">
            <NumField name="purchasePriceInclVat" label="Alış KDVli" value={purchaseInc} onChange={setPurchaseInc} />
            <NumField name="purchasePriceExclVat" label="Alış KDVsiz (boşsa KDVli'den hesaplanır)" value={purchaseExc} onChange={setPurchaseExc} />
            <Row>
              <NumField name="vatPct" label="KDV %" value={vat} onChange={setVat} />
              <NumField name="desi" label="Desi" value={desi} onChange={setDesi} step="0.1" />
            </Row>
            <Row>
              <NumField name="packagingCost" label="Paketleme TL" value={packaging} onChange={setPackaging} />
              <NumField name="advertisingCost" label="Reklam TL" value={advertising} onChange={setAdvertising} />
            </Row>
            <NumField name="targetProfitPct" label="Hedef kâr %" value={target} onChange={setTarget} />
            {purchaseExclVatComputed > 0 && (
              <div className="text-xs text-neutral-500 -mt-1 pt-1 border-t">
                Alış KDVsiz: <strong className="font-mono">{fmtTL(purchaseExclVatComputed)}</strong>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h3 className="font-bold mb-4 text-sm text-orange-700">🛒 Trendyol</h3>
          <div className="space-y-3">
            <NumField name="trendyolPrice" label="Satış KDVli" value={tySale} onChange={setTySale} />
            <NumField name="trendyolCommissionBase" label="Komisyon esas KDVli (boşsa satışla aynı)" value={tyCommBase} onChange={setTyCommBase} />
            <Row>
              <NumField name="trendyolCommissionPct" label="Komisyon %" value={tyCommPct} onChange={setTyCommPct} />
              <NumField name="paymentServicePct" label="Ödeme %" value={payment} onChange={setPayment} step="0.01" />
            </Row>
            <NumField name="trendyolKargoOverride" label="Kargo override TL" value={tyKargo} onChange={setTyKargo} />
          </div>
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h3 className="font-bold mb-4 text-sm text-pink-700">📷 Instagram / PTT</h3>
          <div className="space-y-3">
            <NumField name="instagramPrice" label="Satış KDVli" value={igSale} onChange={setIgSale} />
            <NumField name="pttKargoOverride" label="PTT override KDVli" value={pttKargo} onChange={setPttKargo} />
          </div>
        </section>

        <button
          type="submit"
          disabled={pending}
          className="w-full px-5 py-3 bg-[var(--color-brand-ink)] text-white rounded-lg font-semibold text-sm disabled:opacity-50"
        >
          {pending ? 'Kaydediliyor...' : 'Fiyatlandırmayı Kaydet'}
        </button>

        {msg && (
          <p className={`text-sm px-3 py-2 rounded ${
            msg.kind === 'ok' ? 'bg-green-50 border border-green-200 text-green-800' :
                                  'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {msg.kind === 'ok' ? '✓' : '⚠'} {msg.text}
          </p>
        )}
      </div>

      {/* SAĞ — LIVE OUTPUT */}
      <div className="lg:col-span-2 space-y-4">
        {!purchaseExclVatComputed ? (
          <div className="bg-neutral-50 rounded-xl border border-dashed p-10 text-center text-neutral-500 text-sm">
            Hesaplamayı görmek için en az <strong>Alış KDVli</strong> ya da <strong>Alış KDVsiz</strong> gir.
          </div>
        ) : (
          <>
            {suggested && (
              <section className="bg-[var(--color-brand-ink)] text-white rounded-xl p-5">
                <h4 className="font-bold mb-3 text-xs uppercase tracking-widest opacity-80">
                  Hedef %{n(target) ?? 25} için önerilen
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-orange-300 mb-1">Trendyol</div>
                    <div className="text-2xl font-bold">{fmtTL(suggested.ty.suggestedSalePriceInclVat)}</div>
                    <div className="text-xs text-white/60">Ulaşılan kâr: {fmtPct(suggested.ty.achievedProfitPct)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-pink-300 mb-1">Instagram</div>
                    <div className="text-2xl font-bold">{fmtTL(suggested.ig.suggestedSalePriceInclVat)}</div>
                    <div className="text-xs text-white/60">Ulaşılan kâr: {fmtPct(suggested.ig.achievedProfitPct)}</div>
                  </div>
                </div>
              </section>
            )}

            {trendyolOutput && (
              <section className={`bg-white rounded-xl border-l-4 border-y border-r p-5 ${tierBorder(trendyolOutput.profitTier)}`}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-sm text-orange-700">🛒 Trendyol Mevcut Sonuç</h4>
                  <ProfitBadge tier={trendyolOutput.profitTier} pct={trendyolOutput.profitPct} />
                </div>
                <CalcGrid
                  rows={[
                    ['KDVli satış', fmtTL(trendyolOutput.salePriceInclVat), false],
                    ['KDVsiz satış', fmtTL(trendyolOutput.salePriceExclVat), false],
                    ['Alış KDVsiz', fmtTL(trendyolOutput.purchasePriceExclVat), true],
                    ['Kargo KDVsiz', fmtTL(trendyolOutput.kargoExclVat), true],
                    ['Komisyon KDVli', fmtTL(trendyolOutput.commissionInclVat), true],
                    ['Komisyon KDVsiz', fmtTL(trendyolOutput.commissionExclVat), true],
                    ['Ödeme hizmeti KDVsiz', fmtTL(trendyolOutput.paymentServiceExclVat), true],
                    ['Reklam + Paketleme', fmtTL(trendyolOutput.advertisingCost + trendyolOutput.packagingCost), true],
                  ]}
                />
                <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                  <strong>Net kâr</strong>
                  <strong className={trendyolOutput.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
                    {fmtTL(trendyolOutput.netProfit)}
                  </strong>
                </div>
              </section>
            )}

            {igOutput && (
              <section className={`bg-white rounded-xl border-l-4 border-y border-r p-5 ${tierBorder(igOutput.profitTier)}`}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-sm text-pink-700">📷 Instagram Mevcut Sonuç</h4>
                  <ProfitBadge tier={igOutput.profitTier} pct={igOutput.profitPct} />
                </div>
                <CalcGrid
                  rows={[
                    ['KDVli satış', fmtTL(igOutput.salePriceInclVat), false],
                    ['KDVsiz satış', fmtTL(igOutput.salePriceExclVat), false],
                    ['Alış KDVsiz', fmtTL(igOutput.purchasePriceExclVat), true],
                    ['PTT kargo KDVsiz', fmtTL(igOutput.pttKargoExclVat), true],
                    ['Reklam + Paketleme', fmtTL(igOutput.advertisingCost + igOutput.packagingCost), true],
                  ]}
                />
                <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                  <strong>Net kâr</strong>
                  <strong className={igOutput.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
                    {fmtTL(igOutput.netProfit)}
                  </strong>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </form>
  );
}

function NumField({
  name, label, value, onChange, step,
}: { name: string; label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <label className="block flex-1">
      <span className="text-xs text-neutral-600 block mb-1">{label}</span>
      <input
        name={name}
        type="number"
        step={step ?? 'any'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
      />
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3">{children}</div>;
}

function CalcGrid({ rows }: { rows: Array<[string, string, boolean]> }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
      {rows.map(([label, value, negative], i) => (
        <div key={i} className="contents">
          <span className="text-neutral-600">{label}</span>
          <span className={`text-right font-mono ${negative ? 'text-red-600' : ''}`}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function ProfitBadge({ tier, pct }: { tier: 'profitable' | 'warning' | 'loss'; pct: number }) {
  const cls = tier === 'profitable' ? 'bg-green-100 text-green-900' :
              tier === 'warning' ? 'bg-yellow-100 text-yellow-900' :
              'bg-red-100 text-red-900';
  const label = tier === 'profitable' ? 'Kârlı' : tier === 'warning' ? 'Dikkat' : 'Zararlı';
  return (
    <span className={`text-xs font-bold px-3 py-1 rounded-full ${cls}`}>
      {label} · {fmtPct(pct)}
    </span>
  );
}

function tierBorder(t: string) {
  return t === 'profitable' ? 'border-l-green-500' :
         t === 'warning' ? 'border-l-yellow-500' : 'border-l-red-500';
}
