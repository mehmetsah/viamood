/**
 * Trendyol Product Integration API — tip tanımları.
 *
 * Sözleşme, KargoLab'ın kanıtlanmış Trendyol stok senkron kodundan türetildi
 * (IntegrationStockSyncService.php). Trendyol yanıt alanları sürüme göre değişebildiği
 * için ham satır (TrendyolRawRow) alanlarının tamamı opsiyoneldir; normalize katmanı
 * fallback zincirleriyle sağlamlaştırır.
 */

export interface TrendyolCredentials {
  /** Satıcı ID (cari / supplier id). */
  supplierId: string;
  /** Trendyol entegrasyon API anahtarı. */
  apiKey: string;
  /** Trendyol entegrasyon API gizli anahtarı. */
  secretKey: string;
}

export interface TrendyolImageObject {
  url?: string;
  imageUrl?: string;
  originalUrl?: string;
  src?: string;
}

export type TrendyolImage = TrendyolImageObject | string;

/**
 * Trendyol `/products` yanıtındaki `content[]` satırı.
 * Tüm alanlar opsiyonel — normalize katmanı eksikleri tolere eder.
 */
export interface TrendyolRawRow {
  barcode?: string;
  ean?: string;
  gtin?: string;
  upc?: string;

  stockCode?: string;
  productMainId?: string | number;

  title?: string;
  name?: string;
  productName?: string;
  productMainName?: string;

  brand?: string | { name?: string };
  brandName?: string;

  category?: { name?: string; id?: string | number };
  categoryName?: string;
  categoryId?: string | number;
  pimCategoryName?: string;
  pimCategoryId?: string | number;
  productCategoryName?: string;
  productCategoryId?: string | number;

  quantity?: number;
  stockAmount?: number;
  stock?: number;

  listPrice?: number;
  salePrice?: number;
  vatRate?: number;
  currencyType?: string;

  description?: string;
  approved?: boolean;
  onSale?: boolean;

  images?: TrendyolImage[];
  mainImage?: TrendyolImage;
  productMainImage?: TrendyolImage;

  [key: string]: unknown;
}

/**
 * Normalize edilmiş, Via Mood tarafının tüketebileceği ürün.
 * salePrice/listPrice null olabilir (Trendyol yanıtında yoksa) — çağıran taraf karar verir.
 */
export interface TrendyolProduct {
  barcode: string;
  stockCode: string;
  productMainId: string;
  title: string;
  brand: string;
  categoryName: string;
  categoryId: string;
  quantity: number;
  listPrice: number | null;
  salePrice: number | null;
  currency: string;
  vatRate: number | null;
  description: string;
  approved: boolean;
  onSale: boolean;
  images: string[];
}
