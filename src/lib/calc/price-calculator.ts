/**
 * MoodDepo Satış Fiyatı Hesaplama Modülü
 *
 * Ersin'in teknik notu (2026-05-21):
 *   - İki kanal: Trendyol + Instagram/PTT/Manuel
 *   - Ana mantık: KDVsiz kârlılık üzerinden
 *   - Kâr % = (Net kâr / Alış KDVsiz) × 100  ← satış değil, alış üzerinden
 *   - Hedef %25, %15-25 dikkat, %15 altı zararlı
 *
 * Bütün para alanları TL (decimal). Cents değil — kullanıcı UI tarafında TL girer.
 * KDV oranı default %20.
 */

// ─────────────────────────────────────────────────────────────────────────
// Kargo tabloları (placeholder — Ersin'in exact rate'leri gelince güncellenecek)
// ─────────────────────────────────────────────────────────────────────────

/** Trendyol TEX kargo — desi bazlı (350+ TL siparişler için) */
const TRENDYOL_TEX_BY_DESI: Array<{ maxDesi: number; price: number }> = [
  { maxDesi: 1, price: 35 },
  { maxDesi: 2, price: 40 },
  { maxDesi: 3, price: 45 },
  { maxDesi: 5, price: 60 },
  { maxDesi: 10, price: 85 },
  { maxDesi: 15, price: 110 },
  { maxDesi: 20, price: 140 },
  { maxDesi: 30, price: 180 },
  { maxDesi: Infinity, price: 250 },
];

/** PTT kargo tablosu — desi bazlı (KDV dahil) */
const PTT_BY_DESI: Array<{ maxDesi: number; priceInclVat: number }> = [
  { maxDesi: 1, priceInclVat: 45 },
  { maxDesi: 2, priceInclVat: 50 },
  { maxDesi: 3, priceInclVat: 55 },
  { maxDesi: 5, priceInclVat: 70 },
  { maxDesi: 10, priceInclVat: 100 },
  { maxDesi: 15, priceInclVat: 130 },
  { maxDesi: 20, priceInclVat: 160 },
  { maxDesi: 30, priceInclVat: 200 },
  { maxDesi: Infinity, priceInclVat: 280 },
];

/** Trendyol barem 1 (200 TL altı) — basitleştirilmiş sabit */
const TRENDYOL_BAREM_1 = 25; // TL
/** Trendyol barem 2 (200-350 TL arası) — basitleştirilmiş sabit */
const TRENDYOL_BAREM_2 = 35; // TL

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/** KDVli → KDVsiz ayrıştırma. KDV oranı default 20%. */
export function excludeVat(amount: number, vatPct = 20): number {
  return amount / (1 + vatPct / 100);
}

/** KDVsiz → KDVli */
export function includeVat(amount: number, vatPct = 20): number {
  return amount * (1 + vatPct / 100);
}

/** Trendyol kargo hesaplama */
export function trendyolKargo(salePriceInclVat: number, desi: number): number {
  if (salePriceInclVat < 200) return TRENDYOL_BAREM_1;
  if (salePriceInclVat < 350) return TRENDYOL_BAREM_2;
  const row = TRENDYOL_TEX_BY_DESI.find((r) => desi <= r.maxDesi);
  return row?.price ?? TRENDYOL_TEX_BY_DESI[TRENDYOL_TEX_BY_DESI.length - 1]!.price;
}

/** PTT kargo (KDV dahil) */
export function pttKargoInclVat(desi: number): number {
  const row = PTT_BY_DESI.find((r) => desi <= r.maxDesi);
  return row?.priceInclVat ?? PTT_BY_DESI[PTT_BY_DESI.length - 1]!.priceInclVat;
}

// ─────────────────────────────────────────────────────────────────────────
// Trendyol Hesaplama
// ─────────────────────────────────────────────────────────────────────────

export interface TrendyolInput {
  /** Alış KDVsiz (TL) */
  purchasePriceExclVat: number;
  /** Ürün KDV % (default 20) */
  vatPct?: number;
  /** Desi (ondalıklı olabilir) */
  desi: number;
  /** Trendyol liste satış fiyatı KDVli */
  salePriceInclVat: number;
  /**
   * Komisyona esas fiyat KDVli (referans fiyat - satıcı karşılamalı indirim).
   * İndirim yoksa salePriceInclVat ile aynı verilebilir.
   */
  commissionBasePriceInclVat?: number;
  /** Trendyol komisyon % */
  commissionPct: number;
  /** Ödeme hizmeti % (default 2.85) */
  paymentServicePct?: number;
  /** Reklam maliyeti (TL, KDVsiz kabul) */
  advertisingCost?: number;
  /** Paketleme maliyeti (TL, KDVsiz kabul) */
  packagingCost?: number;
  /**
   * Kargo override (TL). Verilirse otomatik tablo yerine bunu kullan.
   * Verilmezse trendyolKargo(salePriceInclVat, desi) kullanılır.
   */
  kargoOverride?: number;
}

export interface TrendyolOutput {
  // Inputlar (yansıma)
  salePriceInclVat: number;
  commissionBasePriceInclVat: number;
  salePriceExclVat: number;
  // Maliyet kalemleri
  purchasePriceExclVat: number;
  kargoExclVat: number;
  commissionInclVat: number; // komisyon kesintisi KDVli
  commissionExclVat: number; // KDVsiz maliyet kalemi
  paymentServiceInclVat: number;
  paymentServiceExclVat: number;
  advertisingCost: number;
  packagingCost: number;
  totalCostExclVat: number;
  // Sonuçlar
  netProfit: number;
  profitPct: number;
  /** %25 hedef üzeri mi (kârlı yeşil) */
  profitTier: 'profitable' | 'warning' | 'loss';
  /** KDVli satış - KDVli toplam maliyet (cash flow farkı) */
  cashDifferenceInclVat: number;
}

export function calculateTrendyol(input: TrendyolInput): TrendyolOutput {
  const vatPct = input.vatPct ?? 20;
  const paymentPct = input.paymentServicePct ?? 2.85;
  const advertising = input.advertisingCost ?? 0;
  const packaging = input.packagingCost ?? 0;
  const commissionBaseInclVat = input.commissionBasePriceInclVat ?? input.salePriceInclVat;

  // KDVsiz satış
  const salePriceExclVat = excludeVat(input.salePriceInclVat, vatPct);

  // Kargo (KDVsiz kabul — Trendyol kargo zaten satıcıya KDVsiz yansır)
  const kargoExclVat = input.kargoOverride ?? trendyolKargo(input.salePriceInclVat, input.desi);

  // Komisyon
  const commissionInclVat = commissionBaseInclVat * (input.commissionPct / 100);
  const commissionExclVat = commissionInclVat / (1 + vatPct / 100);

  // Ödeme hizmeti
  const paymentServiceInclVat = input.salePriceInclVat * (paymentPct / 100);
  const paymentServiceExclVat = paymentServiceInclVat / (1 + vatPct / 100);

  // Toplam KDVsiz maliyet
  const totalCostExclVat =
    input.purchasePriceExclVat +
    kargoExclVat +
    commissionExclVat +
    paymentServiceExclVat +
    advertising +
    packaging;

  // Kâr
  const netProfit = salePriceExclVat - totalCostExclVat;
  const profitPct =
    input.purchasePriceExclVat > 0
      ? (netProfit / input.purchasePriceExclVat) * 100
      : 0;

  const profitTier: TrendyolOutput['profitTier'] =
    profitPct >= 25 ? 'profitable' : profitPct >= 15 ? 'warning' : 'loss';

  // Cash difference (KDVli net — fatura/ödeme akışı için ham veri)
  const totalCostInclVat =
    includeVat(input.purchasePriceExclVat, vatPct) +
    includeVat(kargoExclVat, vatPct) +
    commissionInclVat +
    paymentServiceInclVat +
    includeVat(advertising, vatPct) +
    includeVat(packaging, vatPct);
  const cashDifferenceInclVat = input.salePriceInclVat - totalCostInclVat;

  return {
    salePriceInclVat: input.salePriceInclVat,
    commissionBasePriceInclVat: commissionBaseInclVat,
    salePriceExclVat,
    purchasePriceExclVat: input.purchasePriceExclVat,
    kargoExclVat,
    commissionInclVat,
    commissionExclVat,
    paymentServiceInclVat,
    paymentServiceExclVat,
    advertisingCost: advertising,
    packagingCost: packaging,
    totalCostExclVat,
    netProfit,
    profitPct,
    profitTier,
    cashDifferenceInclVat,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Instagram / PTT / Manuel Hesaplama
// ─────────────────────────────────────────────────────────────────────────

export interface InstagramInput {
  purchasePriceExclVat: number;
  vatPct?: number;
  desi: number;
  /** Müşteriye satış fiyatı KDVli */
  salePriceInclVat: number;
  advertisingCost?: number;
  packagingCost?: number;
  /** PTT kargo override (KDVli) — verilmezse tablodan */
  pttKargoInclVatOverride?: number;
}

export interface InstagramOutput {
  salePriceInclVat: number;
  salePriceExclVat: number;
  purchasePriceExclVat: number;
  pttKargoInclVat: number;
  pttKargoExclVat: number;
  advertisingCost: number;
  packagingCost: number;
  totalCostExclVat: number;
  netProfit: number;
  profitPct: number;
  profitTier: 'profitable' | 'warning' | 'loss';
  cashDifferenceInclVat: number;
}

export function calculateInstagram(input: InstagramInput): InstagramOutput {
  const vatPct = input.vatPct ?? 20;
  const advertising = input.advertisingCost ?? 0;
  const packaging = input.packagingCost ?? 0;

  const salePriceExclVat = excludeVat(input.salePriceInclVat, vatPct);
  const pttKargoIncl = input.pttKargoInclVatOverride ?? pttKargoInclVat(input.desi);
  const pttKargoExcl = pttKargoIncl / (1 + vatPct / 100);

  const totalCostExclVat =
    input.purchasePriceExclVat + pttKargoExcl + advertising + packaging;
  const netProfit = salePriceExclVat - totalCostExclVat;
  const profitPct =
    input.purchasePriceExclVat > 0
      ? (netProfit / input.purchasePriceExclVat) * 100
      : 0;
  const profitTier: InstagramOutput['profitTier'] =
    profitPct >= 25 ? 'profitable' : profitPct >= 15 ? 'warning' : 'loss';

  const totalCostInclVat =
    includeVat(input.purchasePriceExclVat, vatPct) +
    pttKargoIncl +
    includeVat(advertising, vatPct) +
    includeVat(packaging, vatPct);
  const cashDifferenceInclVat = input.salePriceInclVat - totalCostInclVat;

  return {
    salePriceInclVat: input.salePriceInclVat,
    salePriceExclVat,
    purchasePriceExclVat: input.purchasePriceExclVat,
    pttKargoInclVat: pttKargoIncl,
    pttKargoExclVat: pttKargoExcl,
    advertisingCost: advertising,
    packagingCost: packaging,
    totalCostExclVat,
    netProfit,
    profitPct,
    profitTier,
    cashDifferenceInclVat,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Ters hesap: hedef kâr %'ye göre önerilen satış fiyatı
// ─────────────────────────────────────────────────────────────────────────

export interface SuggestPriceInput {
  channel: 'trendyol' | 'instagram';
  purchasePriceExclVat: number;
  vatPct?: number;
  desi: number;
  targetProfitPct?: number; // default 25
  // Trendyol için ek:
  commissionPct?: number;
  paymentServicePct?: number;
  advertisingCost?: number;
  packagingCost?: number;
}

/**
 * Hedef kâr %'sini sağlayan KDVli satış fiyatını döndürür.
 * Yaklaşım: binary search, kargo/komisyon non-linear olduğu için analitik çözüm karmaşık.
 */
export function suggestSalePrice(input: SuggestPriceInput): {
  suggestedSalePriceInclVat: number;
  achievedProfitPct: number;
} {
  const target = input.targetProfitPct ?? 25;
  const vatPct = input.vatPct ?? 20;

  // Search range: alış KDVli ile alış KDVli × 5 arası
  let lo = includeVat(input.purchasePriceExclVat, vatPct);
  let hi = lo * 5;

  for (let iter = 0; iter < 40; iter++) {
    const mid = (lo + hi) / 2;
    let pct: number;
    if (input.channel === 'trendyol') {
      const out = calculateTrendyol({
        purchasePriceExclVat: input.purchasePriceExclVat,
        vatPct,
        desi: input.desi,
        salePriceInclVat: mid,
        commissionPct: input.commissionPct ?? 18,
        paymentServicePct: input.paymentServicePct ?? 2.85,
        advertisingCost: input.advertisingCost ?? 0,
        packagingCost: input.packagingCost ?? 0,
      });
      pct = out.profitPct;
    } else {
      const out = calculateInstagram({
        purchasePriceExclVat: input.purchasePriceExclVat,
        vatPct,
        desi: input.desi,
        salePriceInclVat: mid,
        advertisingCost: input.advertisingCost ?? 0,
        packagingCost: input.packagingCost ?? 0,
      });
      pct = out.profitPct;
    }
    if (pct < target) lo = mid;
    else hi = mid;
  }

  const suggested = Math.round((lo + hi) / 2);

  // Achieved % kontrolü
  let achieved: number;
  if (input.channel === 'trendyol') {
    achieved = calculateTrendyol({
      purchasePriceExclVat: input.purchasePriceExclVat,
      vatPct,
      desi: input.desi,
      salePriceInclVat: suggested,
      commissionPct: input.commissionPct ?? 18,
      paymentServicePct: input.paymentServicePct ?? 2.85,
      advertisingCost: input.advertisingCost ?? 0,
      packagingCost: input.packagingCost ?? 0,
    }).profitPct;
  } else {
    achieved = calculateInstagram({
      purchasePriceExclVat: input.purchasePriceExclVat,
      vatPct,
      desi: input.desi,
      salePriceInclVat: suggested,
      advertisingCost: input.advertisingCost ?? 0,
      packagingCost: input.packagingCost ?? 0,
    }).profitPct;
  }

  return {
    suggestedSalePriceInclVat: suggested,
    achievedProfitPct: achieved,
  };
}
