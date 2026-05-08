import { sql } from 'drizzle-orm';
import {
  bigint,
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
import { productVariants, products } from './products';
import { vendors } from './vendors';

export const orderFinancialStatus = pgEnum('order_financial_status', [
  'pending',
  'authorized',
  'paid',
  'partially_paid',
  'refunded',
  'partially_refunded',
  'voided',
]);

export const orderFulfillmentStatus = pgEnum('order_fulfillment_status', [
  'unfulfilled',
  'partial',
  'fulfilled',
  'restocked',
]);

export const orderLineItemStatus = pgEnum('order_line_item_status', [
  'pending',         // Henüz routing yapılmadı
  'awaiting_pickup', // Vendor'a atandı, etiket bekliyor
  'shipped',         // Kargoya verildi
  'delivered',       // Teslim edildi
  'cancelled',
  'refunded',
]);

/**
 * Orders — Shopify siparişlerinin lokal aynası.
 * Webhook'tan gelir. Büyüdükçe `created_at` ile aylık partition'a alınacak.
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    // Shopify mapping
    shopifyOrderId: text('shopify_order_id').notNull().unique(),
    shopifyOrderName: text('shopify_order_name').notNull(), // #1001 vs.

    // Customer
    customerId: text('customer_id'), // Shopify customer ID
    customerEmail: text('customer_email'),
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),

    // Shipping address (denormalized for routing engine)
    shippingAddress: jsonb('shipping_address').$type<{
      name?: string;
      phone?: string;
      address1?: string;
      address2?: string;
      city?: string;
      district?: string;
      postalCode?: string;
      country?: string;
      countryCode?: string;
    }>(),

    // Money (cents, TRY)
    subtotalCents: bigint('subtotal_cents', { mode: 'bigint' }).notNull(),
    shippingCents: bigint('shipping_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    taxCents: bigint('tax_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    discountCents: bigint('discount_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    totalCents: bigint('total_cents', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull().default('TRY'),

    // Status
    financialStatus: orderFinancialStatus('financial_status').notNull().default('pending'),
    fulfillmentStatus: orderFulfillmentStatus('fulfillment_status').notNull().default('unfulfilled'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),

    // Vendor distribution (denormalized, set by routing engine)
    vendorCount: integer('vendor_count').notNull().default(0),
    vendorIds: jsonb('vendor_ids').$type<string[]>().default([]),

    // Source
    sourceName: text('source_name'), // web, pos, draft_order
    note: text('note'),
    tags: jsonb('tags').$type<string[]>().default([]),

    // Timing
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull(),

    // Idempotency
    rawShopifyPayload: jsonb('raw_shopify_payload'), // raw webhook body için (audit)

    ...timestamps(),
  },
  (t) => [
    index('orders_placed_at_idx').on(t.placedAt),
    index('orders_customer_idx').on(t.customerId),
    index('orders_financial_status_idx').on(t.financialStatus),
    index('orders_fulfillment_status_idx').on(t.fulfillmentStatus),
  ],
);

/**
 * Order line items — siparişin her satırı, vendor'a göre filtrelenir.
 * Vendor dashboard'da `WHERE vendor_id = X` ile sorgulanır.
 */
export const orderLineItems = pgTable(
  'order_line_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'restrict' }),
    productId: uuid('product_id').references(() => products.id),
    variantId: uuid('variant_id').references(() => productVariants.id),

    // Shopify mapping
    shopifyLineItemId: text('shopify_line_item_id').notNull(),

    // Snapshot at order time (Shopify product can change later, immutable here)
    title: text('title').notNull(),
    variantTitle: text('variant_title'),
    sku: text('sku'),
    quantity: integer('quantity').notNull(),

    // Money snapshots (cents)
    unitPriceCents: bigint('unit_price_cents', { mode: 'bigint' }).notNull(),
    totalPriceCents: bigint('total_price_cents', { mode: 'bigint' }).notNull(),
    discountCents: bigint('discount_cents', { mode: 'bigint' }).notNull().default(sql`0`),

    // Status
    status: orderLineItemStatus('status').notNull().default('pending'),

    // Routing decision (set by routing engine)
    fulfillmentMode: text('fulfillment_mode'), // 'split' | 'consolidate_self' | 'consolidate_carrier'
    assignedAt: timestamp('assigned_at', { withTimezone: true }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ...timestamps(),
  },
  (t) => [
    index('line_items_order_idx').on(t.orderId),
    index('line_items_vendor_status_idx').on(t.vendorId, t.status),
    index('line_items_vendor_created_idx').on(t.vendorId, t.createdAt),
  ],
);
