'use client';

import { useMemo, useState } from 'react';
import {
  calculateInstagram,
  calculateTrendyol,
  excludeVat,
  includeVat,
  suggestSalePrice,
  type InstagramOutput,
  type TrendyolOutput,
} from '@/lib/calc/price-calculator';

function fmtTL(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}
function fmtPct(n: number): string {
  return n.toFixed(1) + ' %';
}

export function CalculatorClient() {
  // Ortak inputlar
  const [productName, setProductName] = useState('Test ürünü');
  const [sku, setSku] = useState('TEST-001');
  const [purchaseInclVat, setPurchaseInclVat] = useState('120');
  const [vatPct, setVatPct] = useState('20');
  const [desi, setDesi] = useState('2');
  const [advertising, setAdvertising] = useState('5');
  const [packaging, setPackaging] = useState('3');
  const [targetProfit, setTargetProfit] = useState('25');

  // Trendyol
  const [trendyolSale, setTrendyolSale] = useState('300');
  const [trendyolCommissionBase, setTrendyolCommissionBase] = useState('');
  const [commissionPct, setCommissionPct] = useState('18');
  const [paymentPct, setPaymentPct] = useState('2.85');
  const [tyKargoOverride, setTyKargoOverride] = useState('');

  // Instagram
  const [instaSale, setInstaSale] = useState('250');
  const [pttOverride, setPttOverride] = useState('');

  const purchaseExclVat = useMemo(() => {
    const inc = parseFloat(purchaseInclVat) || 0;
    return excludeVat(inc, parseFloat(vatPct) || 20);
  }, [purchaseInclVat, vatPct]);

  const trendyolOutput: TrendyolOutput | null = useMemo(() => {
    const inc = parseFloat(trendyolSale) || 0;
    if (inc <= 0 || purchaseExclVat <= 0) return null;
    return calculateTrendyol({
      purchasePriceExclVat: purchaseExclVat,
      vatPct: parseFloat(vatPct) || 20,
      desi: parseFloat(desi) || 0,
      salePriceInclVat: inc,
      commissionBasePriceInclVat: trendyolCommissionBase
        ? parseFloat(trendyolCommissionBase)
        : undefined,
      commissionPct: parseFloat(commissionPct) || 18,
      paymentServicePct: parseFloat(paymentPct) || 2.85,
      advertisingCost: parseFloat(advertising) || 0,
      packagingCost: parseFloat(packaging) || 0,
      kargoOverride: tyKargoOverride ? parseFloat(tyKargoOverride) : undefined,
    });
  }, [
    trendyolSale, purchaseExclVat, vatPct, desi, trendyolCommissionBase,
    commissionPct, paymentPct, advertising, packaging, tyKargoOverride,
  ]);

  const instagramOutput: InstagramOutput | null = useMemo(() => {
    const inc = parseFloat(instaSale) || 0;
    if (inc <= 0 || purchaseExclVat <= 0) return null;
    return calculateInstagram({
      purchasePriceExclVat: purchaseExclVat,
      vatPct: parseFloat(vatPct) || 20,
      desi: parseFloat(desi) || 0,
      salePriceInclVat: inc,
      advertisingCost: parseFloat(advertising) || 0,
      packagingCost: parseFloat(packaging) || 0,
      pttKargoInclVatOverride: pttOverride ? parseFloat(pttOverride) : undefined,
    });
  }, [instaSale, purchaseExclVat, vatPct, desi, advertising, packaging, pttOverride]);

  // Hedef kâr için önerilen fiyatlar
  const suggested = useMemo(() => {
    if (purchaseExclVat <= 0) return null;
    const target = parseFloat(targetProfit) || 25;
    const ty = suggestSalePrice({
      channel: 'trendyol',
      purchasePriceExclVat: purchaseExclVat,
      vatPct: parseFloat(vatPct) || 20,
      desi: parseFloat(desi) || 0,
      targetProfitPct: target,
      commissionPct: parseFloat(commissionPct) || 18,
      paymentServicePct: parseFloat(paymentPct) || 2.85,
      advertisingCost: parseFloat(advertising) || 0,
      packagingCost: parseFloat(packaging) || 0,
    });
    const ig = suggestSalePrice({
      channel: 'instagram',
      purchasePriceExclVat: purchaseExclVat,
      vatPct: parseFloat(vatPct) || 20,
      desi: parseFloat(desi) || 0,
      targetProfitPct: target,
      advertisingCost: parseFloat(advertising) || 0,
      packagingCost: parseFloat(packaging) || 0,
    });
    return { ty, ig, target };
  }, [purchaseExclVat, targetProfit, vatPct, desi, commissionPct, paymentPct, advertising, packaging]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* SOL — INPUTS */}
      <div className="lg:col-span-1 space-y-4">
        <section className="bg-white rounded-xl border p-5">
          <h3 className="font-bold mb-4 text-sm">📦 Ürün Bilgileri</h3>
          <div className="space-y-3">
            <TextField label="Ürün adı" value={productName} onChange={setProductName} />
            <TextField label="SKU / Model ID" value={sku} onChange={setSku} mono />
            <Row>
              <NumField label="Alış KDVli (TL)" value={purchaseInclVat} onChange={setPurchaseInclVat} />
              <NumField label="KDV %" value={vatPct} onChange={setVatPct} />
            </Row>
            <div className="text-xs text-neutral-500 -mt-1">
              Alış KDVsiz: <strong className="font-mono">{fmtTL(purchaseExclVat)}</strong>
            </div>
            <Row>
              <NumField label="Desi" value={desi} onChange={setDesi} step="0.1" />
              <NumField label="Hedef kâr %" value={targetProfit} onChange={setTargetProfit} />
            </Row>
            <Row>
              <NumField label="Paketleme (TL)" value={packaging} onChange={setPackaging} />
              <NumField label="Reklam (TL)" value={advertising} onChange={setAdvertising} />
            </Row>
          </div>
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h3 className="font-bold mb-4 text-sm text-orange-700">🛒 Trendyol Parametreleri</h3>
          <div className="space-y-3">
            <NumField label="Satış fiyatı KDVli" value={trendyolSale} onChange={setTrendyolSale} />
            <NumField
              label="Komisyona esas fiyat KDVli (opsiyonel, boşsa satışla aynı)"
              value={trendyolCommissionBase}
              onChange={setTrendyolCommissionBase}
              placeholder="Boşsa = satış fiyatı"
            />
            <Row>
              <NumField label="Komisyon %" value={commissionPct} onChange={setCommissionPct} />
              <NumField label="Ödeme hizmeti %" value={paymentPct} onChange={setPaymentPct} step="0.01" />
            </Row>
            <NumField
              label="Kargo override (TL, boşsa otomatik)"
              value={tyKargoOverride}
              onChange={setTyKargoOverride}
              placeholder="Boşsa otomatik tablo"
            />
          </div>
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h3 className="font-bold mb-4 text-sm text-pink-700">📷 Instagram / PTT Parametreleri</h3>
          <div className="space-y-3">
            <NumField label="Satış fiyatı KDVli" value={instaSale} onChange={setInstaSale} />
            <NumField
              label="PTT kargo override (KDVli, boşsa otomatik)"
              value={pttOverride}
              onChange={setPttOverride}
              placeholder="Boşsa otomatik tablo"
            />
          </div>
        </section>
      </div>

      {/* SAĞ — OUTPUTS */}
      <div className="lg:col-span-2 space-y-4">
        {/* Önerilen fiyatlar */}
        {suggested && (
          <section className="bg-[var(--color-brand-ink)] text-white rounded-xl p-6">
            <h3 className="font-bold mb-4 text-sm">🎯 Hedef %{suggested.target} için Önerilen Fiyatlar</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-orange-300 mb-2">Trendyol</div>
                <div className="text-3xl font-bold">{fmtTL(suggested.ty.suggestedSalePriceInclVat)}</div>
                <div className="text-xs text-white/60 mt-1">Hedef kâr: {fmtPct(suggested.ty.achievedProfitPct)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-pink-300 mb-2">Instagram / PTT</div>
                <div className="text-3xl font-bold">{fmtTL(suggested.ig.suggestedSalePriceInclVat)}</div>
                <div className="text-xs text-white/60 mt-1">Hedef kâr: {fmtPct(suggested.ig.achievedProfitPct)}</div>
              </div>
            </div>
            <p className="mt-4 text-xs text-white/50 border-t border-white/10 pt-3">
              Bu rakamlar girdiğin parametrelere göre hedef kâr %&apos;sine ulaşmak için minimum satış fiyatıdır.
              Yukarıdaki manuel girdiğin satış fiyatları bu hedefin altındaysa zarara geçersin.
            </p>
          </section>
        )}

        {/* Trendyol Output */}
        {trendyolOutput && (
          <section className={`bg-white rounded-xl border-l-4 ${tierBorderClass(trendyolOutput.profitTier)} border-y border-r p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-orange-700">🛒 Trendyol Sonuçları</h3>
              <ProfitBadge tier={trendyolOutput.profitTier} profitPct={trendyolOutput.profitPct} />
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Line label="KDVli satış" value={fmtTL(trendyolOutput.salePriceInclVat)} />
              <Line label="KDVsiz satış" value={fmtTL(trendyolOutput.salePriceExclVat)} />
              <Line label="Komisyona esas KDVli" value={fmtTL(trendyolOutput.commissionBasePriceInclVat)} />
              <Line label="Komisyon KDVli" value={fmtTL(trendyolOutput.commissionInclVat)} negative />
              <Line label="Alış KDVsiz" value={fmtTL(trendyolOutput.purchasePriceExclVat)} negative />
              <Line label="Komisyon KDVsiz" value={fmtTL(trendyolOutput.commissionExclVat)} negative />
              <Line label="Kargo KDVsiz" value={fmtTL(trendyolOutput.kargoExclVat)} negative />
              <Line label="Ödeme hizmeti KDVsiz" value={fmtTL(trendyolOutput.paymentServiceExclVat)} negative />
              <Line label="Reklam" value={fmtTL(trendyolOutput.advertisingCost)} negative />
              <Line label="Paketleme" value={fmtTL(trendyolOutput.packagingCost)} negative />
              <Line label="Toplam KDVsiz maliyet" value={fmtTL(trendyolOutput.totalCostExclVat)} negative bold />
              <Line label="KDVli nakit farkı" value={fmtTL(trendyolOutput.cashDifferenceInclVat)} />
              <div className="col-span-2 border-t pt-3 mt-1 flex justify-between">
                <strong>Net kâr (KDVsiz)</strong>
                <strong className={trendyolOutput.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {fmtTL(trendyolOutput.netProfit)}
                </strong>
              </div>
              <div className="col-span-2 flex justify-between text-base">
                <strong>Kâr % (net / alış KDVsiz)</strong>
                <strong className={tierTextClass(trendyolOutput.profitTier)}>
                  {fmtPct(trendyolOutput.profitPct)}
                </strong>
              </div>
            </div>
          </section>
        )}

        {/* Instagram Output */}
        {instagramOutput && (
          <section className={`bg-white rounded-xl border-l-4 ${tierBorderClass(instagramOutput.profitTier)} border-y border-r p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-pink-700">📷 Instagram / PTT Sonuçları</h3>
              <ProfitBadge tier={instagramOutput.profitTier} profitPct={instagramOutput.profitPct} />
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Line label="KDVli satış" value={fmtTL(instagramOutput.salePriceInclVat)} />
              <Line label="KDVsiz satış" value={fmtTL(instagramOutput.salePriceExclVat)} />
              <Line label="Alış KDVsiz" value={fmtTL(instagramOutput.purchasePriceExclVat)} negative />
              <Line label="PTT kargo KDVli" value={fmtTL(instagramOutput.pttKargoInclVat)} negative />
              <Line label="PTT kargo KDVsiz" value={fmtTL(instagramOutput.pttKargoExclVat)} negative />
              <Line label="Reklam" value={fmtTL(instagramOutput.advertisingCost)} negative />
              <Line label="Paketleme" value={fmtTL(instagramOutput.packagingCost)} negative />
              <Line label="Toplam KDVsiz maliyet" value={fmtTL(instagramOutput.totalCostExclVat)} negative bold />
              <Line label="KDVli nakit farkı" value={fmtTL(instagramOutput.cashDifferenceInclVat)} />
              <div className="col-span-2 border-t pt-3 mt-1 flex justify-between">
                <strong>Net kâr (KDVsiz)</strong>
                <strong className={instagramOutput.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {fmtTL(instagramOutput.netProfit)}
                </strong>
              </div>
              <div className="col-span-2 flex justify-between text-base">
                <strong>Kâr % (net / alış KDVsiz)</strong>
                <strong className={tierTextClass(instagramOutput.profitTier)}>
                  {fmtPct(instagramOutput.profitPct)}
                </strong>
              </div>
            </div>
          </section>
        )}

        {/* Karşılaştırma */}
        {trendyolOutput && instagramOutput && (
          <section className="bg-neutral-50 rounded-xl border p-5">
            <h3 className="font-bold text-sm mb-3">📊 Karşılaştırma</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-xs text-neutral-500">Kâr farkı</div>
                <div className="font-bold mt-1">
                  {fmtTL(trendyolOutput.netProfit - instagramOutput.netProfit)}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {trendyolOutput.netProfit > instagramOutput.netProfit ? 'Trendyol' : 'Instagram'} daha kârlı
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-neutral-500">Trendyol komisyon yükü</div>
                <div className="font-bold mt-1">{fmtTL(trendyolOutput.commissionInclVat)}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  satışın %{((trendyolOutput.commissionInclVat / trendyolOutput.salePriceInclVat) * 100).toFixed(1)}&apos;ü
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-neutral-500">Kargo farkı</div>
                <div className="font-bold mt-1">
                  {fmtTL(Math.abs(trendyolOutput.kargoExclVat - instagramOutput.pttKargoExclVat))}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {trendyolOutput.kargoExclVat < instagramOutput.pttKargoExclVat ? 'Trendyol' : 'PTT'} daha ucuz
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─────────────────────── UI helpers ───────────────────────

function TextField({
  label, value, onChange, mono,
}: { label: string; value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-600 block mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded-lg px-3 py-2 text-sm ${mono ? 'font-mono' : ''}`}
      />
    </label>
  );
}

function NumField({
  label, value, onChange, step, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; step?: string; placeholder?: string }) {
  return (
    <label className="block flex-1">
      <span className="text-xs text-neutral-600 block mb-1">{label}</span>
      <input
        type="number"
        step={step ?? 'any'}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
      />
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3">{children}</div>;
}

function Line({
  label, value, negative, bold,
}: { label: string; value: string; negative?: boolean; bold?: boolean }) {
  return (
    <>
      <span className="text-neutral-600">{label}</span>
      <span className={`text-right font-mono ${negative ? 'text-red-600' : ''} ${bold ? 'font-bold' : ''}`}>
        {value}
      </span>
    </>
  );
}

function ProfitBadge({ tier, profitPct }: { tier: 'profitable' | 'warning' | 'loss'; profitPct: number }) {
  const cls =
    tier === 'profitable' ? 'bg-green-100 text-green-900' :
    tier === 'warning' ? 'bg-yellow-100 text-yellow-900' :
    'bg-red-100 text-red-900';
  const label = tier === 'profitable' ? 'Kârlı' : tier === 'warning' ? 'Dikkat' : 'Zararlı';
  return (
    <span className={`text-xs font-bold px-3 py-1 rounded-full ${cls}`}>
      {label} · {fmtPct(profitPct)}
    </span>
  );
}

function tierBorderClass(t: string) {
  return t === 'profitable' ? 'border-l-green-500' : t === 'warning' ? 'border-l-yellow-500' : 'border-l-red-500';
}
function tierTextClass(t: string) {
  return t === 'profitable' ? 'text-green-700' : t === 'warning' ? 'text-yellow-700' : 'text-red-700';
}
