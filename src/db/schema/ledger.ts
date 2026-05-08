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
import { orderLineItems, orders } from './orders';
import { vendors } from './vendors';

export const ledgerEntryStatus = pgEnum('ledger_entry_status', [
  'accrued',     // Hak edildi, henüz ödenmedi
  'on_hold',     // Geçici tutuldu (anlaşmazlık)
  'paid',        // Vendor'a ödendi
  'reversed',    // İade nedeniyle tersine alındı
]);

export const ledgerEntryType = pgEnum('ledger_entry_type', [
  'sale',           // Satıştan kazanç
  'refund',         // İade (negative)
  'commission',     // Komisyon kesintisi (negative)
  'fee',            // Platform fee (negative)
  'adjustment',     // Manuel düzeltme
  'payout',         // Ödeme (vendor'a)
]);

/**
 * Commission ledger — her sipariş satırı için hak ediş kaydı.
 * Immutable — değişmez. Reverse durumda yeni `reversed` entry eklenir.
 * Büyüdükçe quarter-bazlı partition'a alınacak.
 */
export const commissionLedger = pgTable(
  'commission_ledger',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    orderLineItemId: uuid('order_line_item_id').references(() => orderLineItems.id),

    type: ledgerEntryType('type').notNull(),
    status: ledgerEntryStatus('status').notNull().default('accrued'),

    // Amounts (cents, signed)
    grossAmountCents: bigint('gross_amount_cents', { mode: 'bigint' }).notNull(),
    commissionRateBps: integer('commission_rate_bps').notNull(), // basis points, snapshot at time of sale
    commissionAmountCents: bigint('commission_amount_cents', { mode: 'bigint' }).notNull(),
    payoutAmountCents: bigint('payout_amount_cents', { mode: 'bigint' }).notNull(),

    currency: text('currency').notNull().default('TRY'),

    // Linkage
    payoutBatchId: uuid('payout_batch_id'),
    reversedById: uuid('reversed_by_id'),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),

    note: text('note'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    ...timestamps(),
  },
  (t) => [
    index('ledger_vendor_status_idx').on(t.vendorId, t.status, t.createdAt),
    index('ledger_order_idx').on(t.orderId),
    index('ledger_payout_batch_idx').on(t.payoutBatchId),
  ],
);

export const payoutStatus = pgEnum('payout_status', [
  'draft',       // Hesaplandı, admin onayı bekliyor
  'approved',    // Onaylandı, ödeme bekliyor
  'processing',  // Banka transferi başlatıldı
  'paid',        // Tamamlandı
  'failed',
  'cancelled',
]);

export const payoutMethod = pgEnum('payout_method', [
  'iyzico_split',     // Anlık split (Iyzico Pazaryeri)
  'iyzico_transfer',  // Iyzico Transfer API ile gönderildi
  'manual_bank',      // Manuel banka aktarımı (CSV export)
  'paytr_bk',         // PayTR Bağlı Kuruluş
]);

/**
 * Payout — vendor'a periyodik ödeme batch'i.
 * Cari mode için: dönem sonunda accrued ledger entry'leri toplanır, payout yaratılır.
 * Marketplace split mode: her sipariş bir payout (ya da auto-batched).
 */
export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'restrict' }),

    method: payoutMethod('method').notNull(),
    status: payoutStatus('status').notNull().default('draft'),

    // Period
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),

    // Amounts
    grossAmountCents: bigint('gross_amount_cents', { mode: 'bigint' }).notNull(),
    commissionAmountCents: bigint('commission_amount_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    feeAmountCents: bigint('fee_amount_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    netAmountCents: bigint('net_amount_cents', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull().default('TRY'),

    // Bank info snapshot (vendor IBAN değişebilir, payout anındaki bilgi tutulur)
    bankIban: text('bank_iban'),
    bankAccountHolder: text('bank_account_holder'),

    // Lifecycle
    approvedByUserId: uuid('approved_by_user_id'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    failureReason: text('failure_reason'),

    // External refs (Iyzico transaction id, banka referansı vs.)
    externalReference: text('external_reference'),

    note: text('note'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    ...timestamps(),
  },
  (t) => [
    index('payouts_vendor_status_idx').on(t.vendorId, t.status),
    index('payouts_period_idx').on(t.periodStart, t.periodEnd),
  ],
);
