import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { vendors } from './vendors';

export const productStatus = pgEnum('product_status', [
  'draft',
  'active',
  'archived',
]);

/**
 * Product — Shopify ürünü ile 1:1 eşleşir.
 * Yetkili vendor bilgisi `vendor_id`.
 * Ürün denormalizasyonu: `vendor_slug`, `vendor_name` read perf için.
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'restrict' }),

    // Shopify mapping
    shopifyProductId: text('shopify_product_id').notNull().unique(),
    shopifyHandle: text('shopify_handle').notNull(),

    // Core
    title: text('title').notNull(),
    description: text('description'),
    productType: text('product_type'),
    tags: jsonb('tags').$type<string[]>().default([]),
    status: productStatus('status').notNull().default('draft'),

    // Denormalized vendor fields (read perf, JOIN'siz)
    vendorSlug: text('vendor_slug').notNull(),
    vendorName: text('vendor_name').notNull(),

    // Aggregated from variants (denormalized, trigger-updated)
    minPriceCents: bigint('min_price_cents', { mode: 'bigint' }),
    maxPriceCents: bigint('max_price_cents', { mode: 'bigint' }),
    totalInventory: integer('total_inventory').default(0),

    // Misc
    featuredImageUrl: text('featured_image_url'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    ...timestamps(),
  },
  (t) => [
    index('products_vendor_status_idx').on(t.vendorId, t.status),
    index('products_vendor_created_idx').on(t.vendorId, t.createdAt),
    index('products_handle_idx').on(t.shopifyHandle),
  ],
);

/**
 * Product variant — Shopify variant ile eşleşir.
 * SKU, fiyat, ağırlık varyant seviyesinde.
 */
export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id') // denormalized
      .notNull()
      .references(() => vendors.id, { onDelete: 'restrict' }),

    // Shopify mapping
    shopifyVariantId: text('shopify_variant_id').notNull().unique(),
    shopifyInventoryItemId: text('shopify_inventory_item_id'),

    // Core
    title: text('title'),
    sku: text('sku'),
    barcode: text('barcode'),

    // Pricing
    priceCents: bigint('price_cents', { mode: 'bigint' }).notNull(),
    compareAtPriceCents: bigint('compare_at_price_cents', { mode: 'bigint' }),
    costCents: bigint('cost_cents', { mode: 'bigint' }), // vendor maliyeti (komisyon hesabı için ileride kullanılabilir)

    // Physical
    weightGrams: integer('weight_grams'),
    requiresShipping: boolean('requires_shipping').notNull().default(true),
    isTaxable: boolean('is_taxable').notNull().default(true),

    // Options
    option1: text('option1'),
    option2: text('option2'),
    option3: text('option3'),

    /**
     * Ersin'in fiyat hesap modülü için pricing config.
     * Tüm para alanları TL cinsinden number (cents değil!).
     * Calculator (/admin/calculator) ile aynı format.
     */
    pricingConfig: jsonb('pricing_config').$type<PricingConfig>().default({}),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ...timestamps(),
  },
  (t) => [
    index('variants_product_idx').on(t.productId),
    index('variants_vendor_idx').on(t.vendorId),
    index('variants_sku_idx').on(t.sku),
    unique('variants_shopify_uq').on(t.shopifyVariantId),
  ],
);

export interface PricingConfig {
  /** Alış KDVsiz (TL) */
  purchasePriceExclVat?: number;
  /** Alış KDVli (TL) — purchasePriceExclVat varsa kullanılmaz, sadece referans */
  purchasePriceInclVat?: number;
  /** KDV % (default 20) */
  vatPct?: number;
  /** Desi (ondalıklı olabilir) */
  desi?: number;
  /** Paketleme maliyeti (TL, KDVsiz) */
  packagingCost?: number;
  /** Reklam maliyeti (TL, KDVsiz) */
  advertisingCost?: number;
  /** Hedef kâr % (default 25) */
  targetProfitPct?: number;
  // Trendyol
  /** Trendyol KDVli satış fiyatı (TL) */
  trendyolPrice?: number;
  /** Trendyol komisyona esas fiyat KDVli (opsiyonel) */
  trendyolCommissionBase?: number;
  /** Trendyol komisyon % */
  trendyolCommissionPct?: number;
  /** Ödeme hizmeti % (default 2.85) */
  paymentServicePct?: number;
  /** Trendyol kargo override (TL) */
  trendyolKargoOverride?: number;
  // Instagram / PTT
  /** Instagram / PTT KDVli satış fiyatı (TL) */
  instagramPrice?: number;
  /** PTT kargo override KDVli (TL) */
  pttKargoOverride?: number;
}
