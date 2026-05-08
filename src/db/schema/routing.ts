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
import { orders } from './orders';

export const fulfillmentMode = pgEnum('fulfillment_mode', [
  'split',                 // Her vendor kendi paketini gönderir
  'consolidate_self',      // Vendor'lar bizim depoya, biz birleştirip yollarız
  'consolidate_carrier',   // Kargocu (KargoLab vb.) toplar ve birleştirir
]);

/**
 * Routing rules — admin tarafından tanımlanan, priority sıralı kurallar.
 * Sipariş geldiğinde priority order'a göre evaluate edilir, ilk eşleşen action uygulanır.
 *
 * Conditions JSON şeması (örnek):
 * {
 *   "all": [
 *     { "field": "shipping.city", "op": "in", "value": ["İstanbul", "Ankara"] },
 *     { "field": "total_cents", "op": ">=", "value": 50000 }
 *   ]
 * }
 *
 * Operators: eq, ne, in, not_in, >=, <=, >, <, contains, exists
 */
export const routingRules = pgTable(
  'routing_rules',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    description: text('description'),
    priority: integer('priority').notNull(),
    conditions: jsonb('conditions').$type<Record<string, unknown>>().notNull(),
    action: fulfillmentMode('action').notNull(),
    enabled: boolean('enabled').notNull().default(true),

    // Stats (denormalized)
    timesMatched: bigint('times_matched', { mode: 'bigint' }).notNull().default(sql`0`),
    lastMatchedAt: text('last_matched_at'),

    ...timestamps(),
  },
  (t) => [
    index('routing_rules_priority_idx').on(t.priority),
    index('routing_rules_enabled_idx').on(t.enabled),
  ],
);

/**
 * Routing decision — her sipariş için tek karar (idempotent).
 * Routing engine bir kez çalışır, sonucu burada saklar.
 */
export const routingDecisions = pgTable(
  'routing_decisions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid('order_id')
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: 'cascade' }),
    matchedRuleId: uuid('matched_rule_id').references(() => routingRules.id),
    mode: fulfillmentMode('mode').notNull(),
    /**
     * Her vendor için yapılan atama:
     * [
     *   { vendor_id, line_item_ids, mode_override, ship_from, ship_to }
     * ]
     */
    assignments: jsonb('assignments').$type<
      Array<{
        vendorId: string;
        lineItemIds: string[];
        modeOverride?: string;
        shipFromLocationId?: string;
        shipToAddress?: Record<string, unknown>;
      }>
    >().notNull(),
    ...timestamps(),
  },
  (t) => [index('routing_decisions_rule_idx').on(t.matchedRuleId)],
);
