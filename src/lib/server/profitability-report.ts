/**
 * Kârlılık raporu — Ersin'in MoodDepo modeline göre.
 *
 * Tüm aktif (deleted_at IS NULL) variant'ları çeker, pricing_config'i olanlar için
 * Trendyol + Instagram kâr %'sini hesaplar, özet + detay döndürür.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventoryLevels, productVariants, products, vendors } from '@/db/schema';
import type { PricingConfig } from '@/db/schema/products';
import {
  calculateInstagram,
  calculateTrendyol,
  excludeVat,
} from '@/lib/calc/price-calculator';

export interface VariantRow {
  variantId: string;
  productId: string;
  productTitle: string;
  vendorName: string;
  sku: string | null;
  status: string;
  createdAt: Date;
  // Stok
  available: number;
  // Pricing config (raw)
  config: PricingConfig;
  // Computed
  purchaseExclVat: number;
  // Trendyol
  trendyolPrice: number | null;
  trendyolProfitTl: number | null;
  trendyolProfitPct: number | null;
  trendyolTier: 'profitable' | 'warning' | 'loss' | null;
  // Instagram
  instagramPrice: number | null;
  instagramProfitTl: number | null;
  instagramProfitPct: number | null;
  instagramTier: 'profitable' | 'warning' | 'loss' | null;
  // En iyi kanal
  bestChannel: 'trendyol' | 'instagram' | null;
  bestProfitTl: number | null;
  // Maliyet kalemleri (Trendyol referansıyla)
  kargoTl: number | null;
  commissionTl: number | null;
  advertisingTl: number;
  packagingTl: number;
  // Stok değeri (alış KDVsiz × available)
  stockValueTl: number;
}

export interface ProfitabilityReport {
  totalVariants: number;
  withPricing: number;
  withoutPricing: number;
  averageTrendyolPct: number; // pricing'i ve Trendyol fiyatı olanların ortalaması
  averageInstagramPct: number;
  averageKargoTl: number;
  averageCommissionTl: number;
  averageAdvertisingTl: number;
  countProfitable: number; // ya Trendyol ya Instagram'da %25+ olan
  countWarning: number;
  countLoss: number;
  totalStockValueTl: number; // ∑ alış KDVsiz × stok
  rows: VariantRow[];
}

export async function buildProfitabilityReport(): Promise<ProfitabilityReport> {
  const raw = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productTitle: products.title,
      vendorName: vendors.name,
      sku: productVariants.sku,
      status: products.status,
      createdAt: products.createdAt,
      available: inventoryLevels.available,
      pricingConfig: productVariants.pricingConfig,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(vendors, eq(vendors.id, productVariants.vendorId))
    .leftJoin(
      inventoryLevels,
      and(
        eq(inventoryLevels.variantId, productVariants.id),
        eq(inventoryLevels.vendorId, productVariants.vendorId),
      ),
    )
    .where(isNull(products.deletedAt));

  const rows: VariantRow[] = raw.map((r) => {
    const config = (r.pricingConfig ?? {}) as PricingConfig;
    const vat = config.vatPct ?? 20;
    // Alış KDVsiz hesapla — yoksa KDVli'den ayrıştır
    const purchaseExclVat =
      config.purchasePriceExclVat ??
      (config.purchasePriceInclVat != null ? excludeVat(config.purchasePriceInclVat, vat) : 0);

    let trendyolProfitTl: number | null = null;
    let trendyolProfitPct: number | null = null;
    let trendyolTier: VariantRow['trendyolTier'] = null;
    let kargoTl: number | null = null;
    let commissionTl: number | null = null;

    if (purchaseExclVat > 0 && config.trendyolPrice) {
      const out = calculateTrendyol({
        purchasePriceExclVat: purchaseExclVat,
        vatPct: vat,
        desi: config.desi ?? 0,
        salePriceInclVat: config.trendyolPrice,
        commissionBasePriceInclVat: config.trendyolCommissionBase,
        commissionPct: config.trendyolCommissionPct ?? 18,
        paymentServicePct: config.paymentServicePct ?? 2.85,
        advertisingCost: config.advertisingCost ?? 0,
        packagingCost: config.packagingCost ?? 0,
        kargoOverride: config.trendyolKargoOverride,
      });
      trendyolProfitTl = out.netProfit;
      trendyolProfitPct = out.profitPct;
      trendyolTier = out.profitTier;
      kargoTl = out.kargoExclVat;
      commissionTl = out.commissionInclVat;
    }

    let igProfitTl: number | null = null;
    let igProfitPct: number | null = null;
    let igTier: VariantRow['instagramTier'] = null;
    if (purchaseExclVat > 0 && config.instagramPrice) {
      const out = calculateInstagram({
        purchasePriceExclVat: purchaseExclVat,
        vatPct: vat,
        desi: config.desi ?? 0,
        salePriceInclVat: config.instagramPrice,
        advertisingCost: config.advertisingCost ?? 0,
        packagingCost: config.packagingCost ?? 0,
        pttKargoInclVatOverride: config.pttKargoOverride,
      });
      igProfitTl = out.netProfit;
      igProfitPct = out.profitPct;
      igTier = out.profitTier;
    }

    let bestChannel: VariantRow['bestChannel'] = null;
    let bestProfitTl: number | null = null;
    if (trendyolProfitTl != null && igProfitTl != null) {
      bestChannel = trendyolProfitTl >= igProfitTl ? 'trendyol' : 'instagram';
      bestProfitTl = Math.max(trendyolProfitTl, igProfitTl);
    } else if (trendyolProfitTl != null) {
      bestChannel = 'trendyol';
      bestProfitTl = trendyolProfitTl;
    } else if (igProfitTl != null) {
      bestChannel = 'instagram';
      bestProfitTl = igProfitTl;
    }

    return {
      variantId: r.variantId,
      productId: r.productId,
      productTitle: r.productTitle,
      vendorName: r.vendorName ?? '—',
      sku: r.sku,
      status: r.status,
      createdAt: r.createdAt,
      available: r.available ?? 0,
      config,
      purchaseExclVat,
      trendyolPrice: config.trendyolPrice ?? null,
      trendyolProfitTl,
      trendyolProfitPct,
      trendyolTier,
      instagramPrice: config.instagramPrice ?? null,
      instagramProfitTl: igProfitTl,
      instagramProfitPct: igProfitPct,
      instagramTier: igTier,
      bestChannel,
      bestProfitTl,
      kargoTl,
      commissionTl,
      advertisingTl: config.advertisingCost ?? 0,
      packagingTl: config.packagingCost ?? 0,
      stockValueTl: purchaseExclVat * (r.available ?? 0),
    };
  });

  // Aggregate
  const withPricing = rows.filter((r) => r.purchaseExclVat > 0).length;
  const tyPcts = rows.map((r) => r.trendyolProfitPct).filter((x): x is number => x != null);
  const igPcts = rows.map((r) => r.instagramProfitPct).filter((x): x is number => x != null);
  const kargos = rows.map((r) => r.kargoTl).filter((x): x is number => x != null);
  const commissions = rows.map((r) => r.commissionTl).filter((x): x is number => x != null);
  const advs = rows.map((r) => r.advertisingTl).filter((x) => x > 0);

  function avg(arr: number[]): number {
    return arr.length === 0 ? 0 : arr.reduce((s, x) => s + x, 0) / arr.length;
  }

  // Tier sayımı: en iyi kanal hangiyse onu kullan
  let countProfitable = 0;
  let countWarning = 0;
  let countLoss = 0;
  for (const r of rows) {
    const tier =
      r.bestChannel === 'trendyol' ? r.trendyolTier :
      r.bestChannel === 'instagram' ? r.instagramTier : null;
    if (tier === 'profitable') countProfitable++;
    else if (tier === 'warning') countWarning++;
    else if (tier === 'loss') countLoss++;
  }

  const totalStockValueTl = rows.reduce((s, r) => s + r.stockValueTl, 0);

  return {
    totalVariants: rows.length,
    withPricing,
    withoutPricing: rows.length - withPricing,
    averageTrendyolPct: avg(tyPcts),
    averageInstagramPct: avg(igPcts),
    averageKargoTl: avg(kargos),
    averageCommissionTl: avg(commissions),
    averageAdvertisingTl: avg(advs),
    countProfitable,
    countWarning,
    countLoss,
    totalStockValueTl,
    rows,
  };
}
