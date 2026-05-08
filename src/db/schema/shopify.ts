/**
 * Shopify entegrasyon tabloları.
 *
 * shopify_connections — her mağaza (shop domain) için OAuth token saklar.
 * Multi-store ileride mümkün olsun diye composite olarak kuruldu.
 *
 * shopify_oauth_states — OAuth flow'unda CSRF nonce'larını tutar (kısa TTL).
 */
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

export const shopifyConnections = pgTable(
  'shopify_connections',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    shopDomain: text('shop_domain').notNull().unique(), // ör. via-mood.myshopify.com

    accessToken: text('access_token').notNull(), // shpat_... veya shpua_...
    scope: text('scope').notNull(),               // virgülle ayrılmış actual scopes

    // Shop info (after install)
    shopId: text('shop_id'),
    shopName: text('shop_name'),
    shopEmail: text('shop_email'),
    countryCode: text('country_code'),
    currency: text('currency'),
    primaryLocationId: text('primary_location_id'),

    // Lifecycle
    installedAt: timestamp('installed_at', { withTimezone: true }).notNull().default(sql`now()`),
    uninstalledAt: timestamp('uninstalled_at', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    ...timestamps(),
  },
  (t) => [
    index('shopify_connections_domain_idx').on(t.shopDomain),
    index('shopify_connections_active_idx').on(t.uninstalledAt),
  ],
);

export const shopifyOauthStates = pgTable(
  'shopify_oauth_states',
  {
    state: text('state').primaryKey(), // random nonce
    shopDomain: text('shop_domain').notNull(),
    initiatedByUserId: uuid('initiated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('shopify_oauth_states_expires_idx').on(t.expiresAt)],
);
