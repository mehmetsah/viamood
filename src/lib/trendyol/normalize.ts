/**
 * Trendyol ham ürün satırı → normalize TrendyolProduct.
 *
 * Saf (yan etkisiz) — bu yüzden birim testlerle canlı API olmadan doğrulanabilir.
 * Fallback zincirleri KargoLab'ın üretimde çalışan alan eşlemesini birebir izler
 * (title/brand/category/images/quantity) + fiyat (salePrice/listPrice) eklenmiştir.
 */
import type { TrendyolImage, TrendyolProduct, TrendyolRawRow } from './types';

function s(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function firstNonEmpty(...vals: unknown[]): string {
  for (const v of vals) {
    const t = s(v);
    if (t !== '') return t;
  }
  return '';
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function imageUrlOf(img: TrendyolImage | undefined): string {
  if (!img) return '';
  if (typeof img === 'string') return img.trim();
  return firstNonEmpty(img.url, img.imageUrl, img.originalUrl, img.src);
}

/** Ham satırdan sıralı, tekilleştirilmiş görsel URL listesi çıkarır. */
export function extractImages(row: TrendyolRawRow): string[] {
  const out: string[] = [];
  if (Array.isArray(row.images)) {
    for (const im of row.images) {
      const u = imageUrlOf(im);
      if (u) out.push(u);
    }
  }
  if (out.length === 0) {
    const single = imageUrlOf(row.mainImage) || imageUrlOf(row.productMainImage);
    if (single) out.push(single);
  }
  return [...new Set(out)];
}

export function normalizeTrendyolRow(row: TrendyolRawRow): TrendyolProduct {
  const brand =
    row.brand && typeof row.brand === 'object'
      ? s(row.brand.name)
      : firstNonEmpty(row.brandName, row.brand);

  const categoryName = firstNonEmpty(
    row.category && typeof row.category === 'object' ? row.category.name : '',
    row.categoryName,
    row.pimCategoryName,
    row.productCategoryName,
  );

  const categoryId = firstNonEmpty(
    row.category && typeof row.category === 'object' ? row.category.id : '',
    row.categoryId,
    row.pimCategoryId,
    row.productCategoryId,
  );

  const q = num(row.quantity ?? row.stockAmount ?? row.stock ?? null);

  return {
    barcode: firstNonEmpty(row.barcode, row.ean, row.gtin, row.upc),
    stockCode: firstNonEmpty(row.stockCode, row.productMainId),
    productMainId: s(row.productMainId),
    title: firstNonEmpty(row.title, row.name, row.productName, row.productMainName),
    brand,
    categoryName,
    categoryId,
    quantity: q == null ? 0 : Math.max(0, Math.round(q)),
    listPrice: num(row.listPrice),
    salePrice: num(row.salePrice),
    currency: firstNonEmpty(row.currencyType) || 'TRY',
    vatRate: num(row.vatRate),
    description: s(row.description),
    approved: row.approved === true,
    onSale: row.onSale === true,
    images: extractImages(row),
  };
}
