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
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';

/**
 * Kargo rate yönetimi — vendor platform tek doğruluk kaynağı.
 *
 * Akış:
 *   1. Admin bir bracket tanımlar (örn. "0-3 kg")
 *   2. KargoLab API'den base rate çekilir (PTT, SÜRAT vs.)
 *   3. Margin yüzdesi uygulanır → satış fiyatı (priceCents)
 *   4. "Push to Shopify" butonuyla Shopify Domestic zone'a publish edilir
 *
 * Multi-channel: aynı bracket tablosu WooCommerce, Trendyol vs.'ye de push edilebilir.
 */

export const shippingRateStatus = pgEnum('shipping_rate_status', [
  'draft',
  'active',
  'archived',
]);

export const shippingRateBrackets = pgTable(
  'shipping_rate_brackets',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** Görünür isim — örn. "Standart Kargo (0-3 kg)" */
    name: text('name').notNull(),

    /** Açıklama (opsiyonel) */
    description: text('description'),

    /** Ağırlık alt sınırı (gr) — bracketinin başlangıcı */
    weightLowGrams: integer('weight_low_grams').notNull().default(0),

    /** Ağırlık üst sınırı (gr) */
    weightHighGrams: integer('weight_high_grams').notNull(),

    /** Hedef ülke ISO code — şimdilik 'TR' fixed */
    countryCode: text('country_code').notNull().default('TR'),

    /** KargoLab base rate (TL cent) — auto-fetched */
    kargolabBaseCents: bigint('kargolab_base_cents', { mode: 'bigint' }),

    /** Hangi kuryer baz alındı (PTT, SÜRAT vs.) */
    kargolabCourier: text('kargolab_courier'),

    /** Last KargoLab fetch zamanı */
    kargolabFetchedAt: jsonb('kargolab_fetched_at').$type<{ at: string }>(),

    /** Margin yüzdesi (örn. 15 = +%15) */
    marginPct: integer('margin_pct').notNull().default(15),

    /** Sabit ek margin (TL cent) — opsiyonel */
    marginFlatCents: bigint('margin_flat_cents', { mode: 'bigint' }).default(sql`0`),

    /** Hesaplanan satış fiyatı (TL cent) — kargolab_base × (1 + margin_pct/100) + margin_flat */
    priceCents: bigint('price_cents', { mode: 'bigint' }).notNull(),

    /** Currency code — TRY fixed şimdilik */
    currency: text('currency').notNull().default('TRY'),

    /** Aktif mi? */
    status: shippingRateStatus('status').notNull().default('draft'),

    /** Shopify ID — push edildikten sonra dolu olur */
    shopifyMethodId: text('shopify_method_id'),

    /** Last Shopify push zamanı */
    shopifyPushedAt: jsonb('shopify_pushed_at').$type<{ at: string }>(),

    /** Order priority — küçük = önce gösterilir */
    sortOrder: integer('sort_order').notNull().default(100),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ...timestamps(),
  },
  (t) => [
    index('shipping_rate_brackets_country_status_idx').on(t.countryCode, t.status),
    index('shipping_rate_brackets_weight_idx').on(t.weightLowGrams, t.weightHighGrams),
  ],
);

/**
 * Shipping fulfillment events — Shopify order'dan KargoLab'a giden shipment'ları takip.
 */
export const shipmentSyncs = pgTable(
  'shipment_syncs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** Shopify order ID (gid://...) */
    shopifyOrderId: text('shopify_order_id').notNull(),
    /** Shopify order name (#1023) */
    shopifyOrderName: text('shopify_order_name'),
    /** KargoLab shipment ID — başarılı olduktan sonra dolu */
    kargolabShipmentId: text('kargolab_shipment_id'),
    /** KargoLab tracking number */
    kargolabTrackingNumber: text('kargolab_tracking_number'),
    /** Hangi kuryere gönderildi */
    courier: text('courier'),
    /** Snapshot: gönderim ağırlığı (gr) */
    weightGrams: integer('weight_grams'),
    /** Snapshot: gönderim fiyatı (TL cent) */
    priceCents: bigint('price_cents', { mode: 'bigint' }),
    /** Sync durumu */
    status: text('status').notNull().default('pending'),
    /** Error message — fail durumunda */
    errorMessage: text('error_message'),
    /** Snapshot: alıcı + adres */
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().default({}),
    /** KargoLab raw response */
    kargolabResponse: jsonb('kargolab_response').$type<Record<string, unknown>>(),
    syncedAt: jsonb('synced_at').$type<{ at: string }>(),
    ...timestamps(),
  },
  (t) => [
    index('shipment_syncs_order_idx').on(t.shopifyOrderId),
    index('shipment_syncs_status_idx').on(t.status),
    index('shipment_syncs_tracking_idx').on(t.kargolabTrackingNumber),
  ],
);
