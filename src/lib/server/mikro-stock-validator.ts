/**
 * Mikro stok karşılaştırması.
 *
 * Yunus 2026-05-21'de "via stoklar db.xlsx" attı — Mikro'da kayıtlı 282 stok kodu.
 * Bizim ürün/variant SKU'larımızı bu listeye karşı doğrularız.
 *
 * Kurallar (Yunus mesajı):
 *  - Stok kodunun başına `VIA` eklenir (ara depo sevkiyat) → bizim SKU '100' = Mikro 'VIA100'
 *  - Mikro'da olmayan SKU → sipariş aktarılamaz (Yunus: "hata verir, bunu aktaramadı der")
 *
 * Bu modül:
 *  1. JSON seed'i yükler (282 stok)
 *  2. DB'deki tüm aktif variant SKU'larını çeker
 *  3. Eşleşme + eksikleri raporlar
 */
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { productVariants, products } from '@/db/schema';
import { env } from '@/lib/env';
import stockData from './mikro-data/stocks-2026-05-21.json';

export interface MikroStock {
  sku: string;
  name: string;
}

export interface StockReport {
  /** Mikro'da var olan toplam stok */
  mikroTotal: number;
  /** Bizim DB'de var olan aktif (deleted_at IS NULL) variant sayısı */
  dbTotal: number;
  /** Mikro'da karşılığı olan variant sayısı */
  matchedCount: number;
  /** Mikro'da karşılığı olmayan variant'lar */
  missing: Array<{
    variantId: string;
    sku: string;
    productTitle: string;
    vendorName: string | null;
    stokKoduMikro: string; // VIA prefix uygulanmış hali
  }>;
  /** Bizim DB'de olmayan ama Mikro'da bulunan stoklar (referans için) */
  unusedInDb: MikroStock[];
}

const STOCKS = stockData.stocks as MikroStock[];
const MIKRO_SKU_SET = new Set(STOCKS.map((s) => s.sku.toUpperCase()));

function toMikroStokKodu(rawSku: string): string {
  const s = rawSku.trim().toUpperCase();
  if (s.startsWith(env.MIKRO_STOK_PREFIX.toUpperCase())) return s;
  return `${env.MIKRO_STOK_PREFIX.toUpperCase()}${s}`;
}

/** Bizim SKU → Mikro'da var mı? */
export function isMikroKnown(sku: string): boolean {
  if (!sku) return false;
  const stripped = sku.trim().toUpperCase().replace(
    new RegExp(`^${env.MIKRO_STOK_PREFIX.toUpperCase()}`),
    '',
  );
  return MIKRO_SKU_SET.has(stripped);
}

export async function generateStockReport(): Promise<StockReport> {
  // DB'deki tüm aktif variantlar
  const dbVariants = await db
    .select({
      variantId: productVariants.id,
      sku: productVariants.sku,
      productTitle: products.title,
      vendorName: products.vendorName,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        isNull(products.deletedAt),
        isNotNull(productVariants.sku),
      ),
    );

  const matched: typeof dbVariants = [];
  const missing: StockReport['missing'] = [];
  const dbSkuSet = new Set<string>();

  for (const v of dbVariants) {
    if (!v.sku) continue;
    const stripped = v.sku.trim().toUpperCase().replace(
      new RegExp(`^${env.MIKRO_STOK_PREFIX.toUpperCase()}`),
      '',
    );
    dbSkuSet.add(stripped);
    if (MIKRO_SKU_SET.has(stripped)) {
      matched.push(v);
    } else {
      missing.push({
        variantId: v.variantId,
        sku: v.sku,
        productTitle: v.productTitle,
        vendorName: v.vendorName,
        stokKoduMikro: toMikroStokKodu(v.sku),
      });
    }
  }

  const unusedInDb = STOCKS.filter((s) => !dbSkuSet.has(s.sku.toUpperCase()));

  return {
    mikroTotal: STOCKS.length,
    dbTotal: dbVariants.length,
    matchedCount: matched.length,
    missing,
    unusedInDb,
  };
}
