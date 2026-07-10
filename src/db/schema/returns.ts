import { bigint, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { customers } from './customers';
import { orders } from './orders';

/** İade satırı — hangi ürün(ler), ne kadar. */
export interface ReturnLineItem {
  title: string;
  quantity: number;
  priceCents?: number;
}

/**
 * Müşteri iade talepleri. Portal /hesabim/iadeler + admin işleme.
 * return_code = müşterinin PTT şubesinde söyleyeceği kod (İADE-XXXXX).
 */
export const returns = pgTable(
  'returns',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    // Görüntüleme için sipariş adı (#1033) — order silinse de kalır
    orderName: text('order_name'),
    returnCode: text('return_code').notNull().unique(),
    // awaiting_shipment | in_review | completed | rejected
    status: text('status').notNull().default('awaiting_shipment'),
    reason: text('reason'),
    refundAmountCents: bigint('refund_amount_cents', { mode: 'bigint' }).notNull().default(0n),
    carrier: text('carrier'), // iade kargosu firması (PTT vb.)
    trackingNumber: text('tracking_number'),
    lineItems: jsonb('line_items').$type<ReturnLineItem[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('returns_customer_idx').on(t.customerId),
    index('returns_order_idx').on(t.orderId),
    index('returns_status_idx').on(t.status),
  ],
);
