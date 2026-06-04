import { sql } from 'drizzle-orm';
import {
  bigint,
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
import { productVariants } from './products';
import { vendors } from './vendors';

export const bundleStatus = pgEnum('bundle_status', [
  'draft',
  'active',
  'archived',
]);

/**
 * Bundle (set) ürün — birden fazla variant'ı tek SKU + tek fiyat altında satar.
 *
 * Yaratım kuralları:
 *   - Vendor: sadece kendi ürünlerinden bundle yapar (vendor_id zorunlu).
 *   - Admin: vendor_id NULL bırakılabilir → karma vendor bundle ("Via Mood seçkisi").
 *
 * Stok mantığı:
 *   - "Set olarak hazırlanmış adet" `inventory_quantity` — kaç tane set hazır.
 *   - Set hazırlama → komponent variant.available'lardan (qty * inventory_quantity) düşürülür.
 *   - Set bozma / arşivleme → komponentlere geri eklenir.
 *
 * Shopify push:
 *   - Bundle ayrı bir ürün olarak Shopify'a yazılır (kendi SKU + fiyat + görsel).
 *   - shopify_* alanları push sonrası dolar.
 */
export const productBundles = pgTable(
  'product_bundles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** NULL = admin'in karma bundle'ı (cross-vendor). Vendor bundle'ı için zorunlu. */
    vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'restrict' }),

    title: text('title').notNull(),
    handle: text('handle').notNull().unique(),
    sku: text('sku').notNull().unique(),
    description: text('description'),
    /** Ana görsel — manuel olarak vendor/admin tarafından girilir */
    featuredImageUrl: text('featured_image_url'),
    /**
     * Galeri (sub) görselleri — seçilen komponent variant'ların imageUrl'lerinden
     * otomatik türetilir. Vendor manuel düzenleyebilir (üzerine yazabilir).
     */
    galleryImageUrls: jsonb('gallery_image_urls').$type<string[]>().default([]).notNull(),
    status: bundleStatus('status').notNull().default('draft'),

    /** Vendor'un belirlediği özel set satış fiyatı (TL cent) */
    bundlePriceCents: bigint('bundle_price_cents', { mode: 'bigint' }).notNull(),

    /** Hazır set adedi (set yapma sırasında komponentlerden çekilen toplam) */
    inventoryQuantity: integer('inventory_quantity').notNull().default(0),

    /** Set'in kendi kargo boyutu — komponentlerin ayrı ayrı kargosundan farklı */
    packageWeightGrams: integer('package_weight_grams'),
    packageDimensionsCm: jsonb('package_dimensions_cm').$type<{
      length: number;
      width: number;
      height: number;
    }>(),

    /** Shopify mapping (push sonrası) */
    shopifyProductId: text('shopify_product_id'),
    shopifyVariantId: text('shopify_variant_id'),
    shopifyInventoryItemId: text('shopify_inventory_item_id'),
    shopifyHandle: text('shopify_handle'),

    /** Snapshot — Shopify'da görünecek vendor name (Via Mood veya vendor adı) */
    displayVendorName: text('display_vendor_name'),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ...timestamps(),
  },
  (t) => [
    index('bundles_vendor_status_idx').on(t.vendorId, t.status),
    index('bundles_handle_idx').on(t.handle),
    unique('bundles_sku_uq').on(t.sku),
  ],
);

/**
 * Bundle'ın komponentleri — hangi variant + kaç adet.
 *
 * Snapshot alanlar (cost / price / shipping) bundle yaratıldığı anda
 * dondurulur — komponent fiyatı değişse bile bundle hesabı sabit kalır.
 * Bundle düzenlenirse snapshot'lar yenilenir.
 */
export const bundleComponents = pgTable(
  'bundle_components',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    bundleId: uuid('bundle_id')
      .notNull()
      .references(() => productBundles.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),

    /** Bu komponentten set başına kaç adet */
    quantity: integer('quantity').notNull(),

    /** Anlık snapshot — bundle hesabını sabitlemek için */
    costSnapshotCents: bigint('cost_snapshot_cents', { mode: 'bigint' }),
    priceSnapshotCents: bigint('price_snapshot_cents', { mode: 'bigint' }).notNull(),
    /** Komponentin tekil kargo maliyeti (TL cent) — şimdilik weight × rate */
    shippingSnapshotCents: bigint('shipping_snapshot_cents', { mode: 'bigint' }).default(sql`0`),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ...timestamps(),
  },
  (t) => [
    index('bundle_components_bundle_idx').on(t.bundleId),
    index('bundle_components_variant_idx').on(t.variantId),
    unique('bundle_components_uq').on(t.bundleId, t.variantId),
  ],
);
