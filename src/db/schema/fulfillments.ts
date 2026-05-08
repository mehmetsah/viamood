import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { orderLineItems, orders } from './orders';
import { vendors } from './vendors';

export const fulfillmentStatus = pgEnum('fulfillment_status', [
  'pending',         // Vendor'a atanmış, etiket bekliyor
  'label_created',   // KargoLab'tan etiket basıldı
  'picked_up',       // Kargocu teslim aldı
  'in_transit',      // Yolda
  'out_for_delivery',// Dağıtıma çıktı
  'delivered',
  'failed',          // Teslimat başarısız
  'returned',
  'cancelled',
]);

/**
 * Fulfillment — bir sipariş içindeki bir vendor'ın gönderim paketi.
 * Bir order'da birden fazla fulfillment olabilir (split mode).
 * Consolidate mode'da hub fulfillment + N vendor inbound fulfillment olabilir.
 */
export const fulfillments = pgTable(
  'fulfillments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'restrict' }),

    // Shopify mapping (Shopify FulfillmentOrders / Fulfillment)
    shopifyFulfillmentOrderId: text('shopify_fulfillment_order_id'),
    shopifyFulfillmentId: text('shopify_fulfillment_id'),

    // KargoLab
    kargolabShipmentId: text('kargolab_shipment_id'),
    carrier: text('carrier'),                  // Aras, MNG, Yurtiçi vs.
    trackingNumber: text('tracking_number'),
    trackingUrl: text('tracking_url'),
    labelUrl: text('label_url'),

    // Status
    status: fulfillmentStatus('status').notNull().default('pending'),

    // Addresses
    shipFromAddress: jsonb('ship_from_address').$type<Record<string, unknown>>(),
    shipToAddress: jsonb('ship_to_address').$type<Record<string, unknown>>(),

    // Package details
    packageWeightGrams: integer('package_weight_grams'),
    packageDimensionsCm: jsonb('package_dimensions_cm').$type<{
      length: number;
      width: number;
      height: number;
    }>(),

    // Timestamps
    labelCreatedAt: timestamp('label_created_at', { withTimezone: true }),
    pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ...timestamps(),
  },
  (t) => [
    index('fulfillments_order_idx').on(t.orderId),
    index('fulfillments_vendor_status_idx').on(t.vendorId, t.status),
    index('fulfillments_tracking_idx').on(t.trackingNumber),
  ],
);

/**
 * Fulfillment ↔ line items many-to-many (split aware).
 * Aynı line item kısmen gönderilebilir.
 */
export const fulfillmentLineItems = pgTable(
  'fulfillment_line_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    fulfillmentId: uuid('fulfillment_id')
      .notNull()
      .references(() => fulfillments.id, { onDelete: 'cascade' }),
    lineItemId: uuid('line_item_id')
      .notNull()
      .references(() => orderLineItems.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    ...timestamps(),
  },
  (t) => [
    index('fli_fulfillment_idx').on(t.fulfillmentId),
    index('fli_line_item_idx').on(t.lineItemId),
  ],
);

/**
 * Tracking events — KargoLab'tan gelen webhook event'leri.
 * Müşteriye anlık durum göstermek için.
 */
export const trackingEvents = pgTable(
  'tracking_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    fulfillmentId: uuid('fulfillment_id')
      .notNull()
      .references(() => fulfillments.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    location: text('location'),
    description: text('description'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    rawPayload: jsonb('raw_payload'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('tracking_fulfillment_idx').on(t.fulfillmentId, t.occurredAt)],
);
