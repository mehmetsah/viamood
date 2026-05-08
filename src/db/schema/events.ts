import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt } from './_shared';
import { orders } from './orders';

/**
 * Order events — append-only event log.
 * Sipariş yaşam döngüsündeki her olay (created, paid, routed, fulfilled, cancelled, refunded).
 * Audit + replay + debug için.
 * Büyüdükçe aylık partition'a alınacak.
 */
export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
    actorType: text('actor_type'), // 'system' | 'admin' | 'vendor' | 'customer' | 'shopify_webhook'
    actorId: text('actor_id'),     // user_id veya 'webhook:<id>'
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdAt: createdAt(),
  },
  (t) => [
    index('order_events_order_idx').on(t.orderId, t.occurredAt),
    index('order_events_type_idx').on(t.eventType),
  ],
);

/**
 * Event türleri (constant tip — string union için ts-side):
 *   order_created, order_paid, order_routed,
 *   line_item_assigned, line_item_picked, line_item_shipped, line_item_delivered,
 *   order_cancelled, order_refunded
 */
