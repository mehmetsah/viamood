import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { productVariants } from './products';
import { vendors } from './vendors';

/**
 * Inventory level — vendor başına stok seviyesi.
 * Composite PK: (vendor_id, variant_id).
 * Optimistic concurrency: `version` artar her update'te, conflict tespit eder.
 */
export const inventoryLevels = pgTable(
  'inventory_levels',
  {
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),

    quantity: integer('quantity').notNull().default(0),
    reserved: integer('reserved').notNull().default(0), // pending sipariş için ayrılmış
    available: integer('available').notNull().default(0), // quantity - reserved (denormalized)

    // Shopify location mapping
    shopifyLocationId: text('shopify_location_id'),
    shopifyInventoryLevelId: text('shopify_inventory_level_id'),
    lastSyncedAt: text('last_synced_at'),

    version: integer('version').notNull().default(1), // optimistic lock

    ...timestamps(),
  },
  (t) => [
    primaryKey({ columns: [t.vendorId, t.variantId] }),
    index('inventory_variant_idx').on(t.variantId),
    index('inventory_updated_idx').on(t.updatedAt),
  ],
);
