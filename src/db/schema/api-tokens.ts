import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { vendors } from './vendors';
import { users } from './auth';

/**
 * Vendor API tokens — vendor'lar kendi sistemlerinden bizim REST API'ye Bearer auth ile
 * ürün/stok push edebilsin diye.
 *
 * Token formatı: `vnd_<vendorId8>_<random32>` (vendor ID prefix debug için).
 * DB'de SHA-256 hash'i tutulur (plaintext sadece create anında geri döner).
 *
 * Scope'lar (ileride genişletilebilir): products:write, products:read,
 *   inventory:write, orders:read.
 */
export const vendorApiTokens = pgTable(
  'vendor_api_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),

    /** Kullanıcıya gösterilen ad — örn. "Trendyol Sync Worker" */
    name: text('name').notNull(),
    /** Token prefix (ilk 12 karakter) — UI'da gösterilir ki user hangisi olduğunu bilsin */
    prefix: text('prefix').notNull(),
    /** SHA-256(plaintext token) hex */
    tokenHash: text('token_hash').notNull().unique(),

    /** İzin verilen scope'lar */
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),

    /** Son kullanım — heartbeat */
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    lastUsedIp: text('last_used_ip'),

    /** İptal edilme */
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),

    /** Otomatik süre dolumu (opsiyonel) */
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    ...timestamps(),
  },
  (t) => [
    index('api_tokens_vendor_idx').on(t.vendorId),
    index('api_tokens_hash_idx').on(t.tokenHash),
  ],
);
