import { sql } from 'drizzle-orm';
import { date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { users } from './auth';
import { vendors } from './vendors';

/**
 * FAZ 3.3 — Hibrit toplama turu (pickup run) + durakları.
 *
 * Günün `stockLocation='supplier_pickup'` kalemleri tedarikçi bazında toplanır:
 * bir "toplama turu" oluşturulur, her tedarikçi bir DURAK olur (rota sırasıyla).
 * Durak toplandıkça o duraktaki sipariş kalemleri awaiting_pickup → collected olur.
 * Additive; canlı sipariş akışına dokunmaz (kalem durumu değişimi hariç).
 */

export const pickupRunStatus = pgEnum('pickup_run_status', [
  'planned',    // Rota oluşturuldu, toplama başlamadı
  'collecting', // En az bir durak toplandı
  'completed',  // Tüm duraklar toplandı/atlandı
  'cancelled',
]);

export const pickupStopStatus = pgEnum('pickup_stop_status', [
  'pending',   // Toplanmadı
  'collected', // Tedarikçiden alındı
  'received',  // Depoya giriş yapıldı (FAZ 3.5)
  'skipped',   // Atlandı (bu turda alınmadı)
]);

export const pickupRuns = pgTable(
  'pickup_runs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    runDate: date('run_date').notNull(),
    status: pickupRunStatus('status').notNull().default('planned'),
    stopCount: integer('stop_count').notNull().default(0),
    itemCount: integer('item_count').notNull().default(0),
    totalQuantity: integer('total_quantity').notNull().default(0),
    note: text('note'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('pickup_runs_date_idx').on(t.runDate), index('pickup_runs_status_idx').on(t.status)],
);

export const pickupRunStops = pgTable(
  'pickup_run_stops',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    pickupRunId: uuid('pickup_run_id')
      .notNull()
      .references(() => pickupRuns.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),

    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'restrict' }),
    vendorName: text('vendor_name').notNull(), // snapshot
    city: text('city'),
    district: text('district'),

    itemCount: integer('item_count').notNull().default(0),
    totalQuantity: integer('total_quantity').notNull().default(0),
    /** Bu duraktaki sipariş kalemi id'leri (rota oluşturulduğu andaki snapshot). */
    lineItemIds: jsonb('line_item_ids').$type<string[]>().notNull().default([]),

    status: pickupStopStatus('status').notNull().default('pending'),
    collectedAt: timestamp('collected_at', { withTimezone: true, mode: 'date' }),
    collectedBy: uuid('collected_by').references(() => users.id, { onDelete: 'set null' }),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' }),
    ...timestamps(),
  },
  (t) => [
    unique('pickup_run_stops_run_vendor_uq').on(t.pickupRunId, t.vendorId),
    index('pickup_run_stops_run_idx').on(t.pickupRunId),
  ],
);
