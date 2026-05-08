import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Audit log — immutable record of every meaningful action by admin/vendor.
 * KVKK ve internal forensics için zorunlu.
 * Aylık partition'a alınacak.
 *
 * Asla update/delete edilmez. Append-only.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    // Who
    actorType: text('actor_type').notNull(), // 'user' | 'system' | 'webhook'
    actorId: text('actor_id'),                // user_id, webhook source vs.
    actorIpAddress: text('actor_ip_address'),
    actorUserAgent: text('actor_user_agent'),

    // What
    action: text('action').notNull(),         // 'vendor.create', 'product.update', 'payout.approve' vs.
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),

    // Change (diff)
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),

    // Context
    requestId: text('request_id'),  // korelasyon için
    note: text('note'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('audit_actor_idx').on(t.actorId, t.occurredAt),
    index('audit_entity_idx').on(t.entityType, t.entityId),
    index('audit_action_idx').on(t.action, t.occurredAt),
    index('audit_occurred_idx').on(t.occurredAt),
  ],
);

/**
 * Idempotency keys — webhook + payment + critical write işlemlerinin tekrarını engeller.
 * TTL ile (örn. 24 saat) otomatik temizlenir.
 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: text('key').primaryKey(),
    scope: text('scope').notNull(),         // 'shopify_webhook', 'iyzico_callback', 'kargolab_webhook'
    requestHash: text('request_hash'),      // body hash — fark varsa yeni istek
    responseStatus: text('response_status'),
    responseBody: jsonb('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('idemp_scope_idx').on(t.scope),
    index('idemp_expires_idx').on(t.expiresAt),
  ],
);
