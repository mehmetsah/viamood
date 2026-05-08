import { sql } from 'drizzle-orm';
import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * UUID v7 default — time-sortable, b-tree friendly, distributed-safe.
 * Requires Postgres 17+ for native uuidv7(), or pg_uuidv7 extension on older.
 * Falls back to gen_random_uuid() if neither available; can swap later.
 */
export const uuidV7 = (name: string) =>
  uuid(name).primaryKey().default(sql`gen_random_uuid()`);

/** Created at — auto set, never updated. */
export const createdAt = (name = 'created_at') =>
  timestamp(name, { withTimezone: true, mode: 'date' })
    .notNull()
    .default(sql`now()`);

/** Updated at — manually set in application or trigger. */
export const updatedAt = (name = 'updated_at') =>
  timestamp(name, { withTimezone: true, mode: 'date' })
    .notNull()
    .default(sql`now()`);

/** Soft delete marker — null means not deleted. */
export const deletedAt = (name = 'deleted_at') =>
  timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Money in integer cents (e.g. 1599 = 15.99 TRY).
 * Avoid float — accumulating rounding errors over millions of orders.
 * Bigint to allow up to 9 quadrillion cents (Turkey-safe forever).
 */
export const moneyCents = (name: string) =>
  customType<{ data: bigint; driverData: string }>({
    dataType: () => 'bigint',
    fromDriver: (v) => BigInt(v),
    toDriver: (v) => v.toString(),
  })(name);

/** Currency ISO code, default TRY. */
export const currency = customType<{ data: string }>({
  dataType: () => 'char(3)',
});

/**
 * Common columns every record gets.
 * Spread into table definitions: ...timestamps()
 */
export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});
