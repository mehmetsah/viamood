import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { users } from './auth';

export const vendorStatus = pgEnum('vendor_status', [
  'pending',     // KYC bekliyor
  'active',      // Onaylı, satış yapabilir
  'suspended',   // Geçici durduruldu
  'rejected',    // KYC reddedildi
  'archived',    // Arşivlendi (soft delete)
]);

export const paymentMode = pgEnum('payment_mode', [
  'marketplace_split', // Iyzico/PayTR otomatik split
  'cari',              // Manuel periyodik settlement
]);

export const membershipRole = pgEnum('membership_role', [
  'owner',     // Vendor sahibi (full yetki)
  'manager',   // Yönetici (ürün, sipariş, fulfillment)
  'staff',     // Sınırlı (sadece sipariş listele/etiket bas)
  'viewer',    // Sadece okuma
]);

/**
 * Vendor (tedarikçi).
 * Multi-tenant key — tüm vendor verisi `vendor_id` ile ilişkili.
 * Counters denormalize edilir (read perf), trigger ile güncellenir.
 */
export const vendors = pgTable(
  'vendors',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    // Public identity
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    legalName: text('legal_name'),
    description: text('description'),
    logoUrl: text('logo_url'),

    // Contact
    email: text('email').notNull(),
    phone: text('phone'),
    website: text('website'),

    // Legal / tax (Turkey)
    taxId: text('tax_id'),                  // Vergi numarası
    taxOffice: text('tax_office'),          // Vergi dairesi
    mersisNo: text('mersis_no'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    district: text('district'),
    postalCode: text('postal_code'),
    country: text('country').default('TR'),

    // Banking (cari mode payouts)
    bankName: text('bank_name'),
    bankBranch: text('bank_branch'),
    iban: text('iban'),
    accountHolderName: text('account_holder_name'),

    // Status
    status: vendorStatus('status').notNull().default('pending'),
    suspendedReason: text('suspended_reason'),

    // Commission & payment
    commissionRate: integer('commission_rate').notNull().default(0), // basis points (0 = %0, 500 = %5)
    paymentMode: paymentMode('payment_mode').notNull().default('cari'),
    paymentTermsDays: integer('payment_terms_days').default(30),
    iyzicoSubmerchantKey: text('iyzico_submerchant_key'), // Iyzico Pazaryeri ID

    // KargoLab entegrasyonu — her tedarikçi Via Mood tenant'ında (kargo.viamood.com.tr)
    // AYRI bir üye olarak açılır. Bu alan o üyenin numarasını tutar; boşsa tedarikçi
    // henüz KargoLab'e kaydedilmemiştir (panelde kargo/cari bölümü kapalı gelir).
    // Tedarikçi KargoLab ile çalışmayı kabul etti mi? Üye açılışının TETİKLEYİCİSİ
    // budur — başvuru onayı değil (kullanıcı kararı 2026-08-19: "ilgili üye kargolab
    // ile çalışır dediğimizde bu oluşmalı"). Onaylanmış ama kargo anlaşması olmayan
    // tedarikçiye KargoLab üyesi açmak boş cari hesap yaratırdı.
    kargolabEnabled: boolean('kargolab_enabled').notNull().default(false),
    // Via Mood üst sözleşmesi altında tedarikçiye verilen alt sözleşme numarası
    // (varsa). Bilgi amaçlı; kargo çıkışı Via Mood sözleşmesiyle yapılır.
    kargolabContractNo: text('kargolab_contract_no'),
    kargolabMemberId: integer('kargolab_member_id'),
    kargolabSyncedAt: timestamp('kargolab_synced_at', { withTimezone: true }),
    kargolabSyncError: text('kargolab_sync_error'),

    // Denormalized counters (trigger-updated)
    productCount: integer('product_count').notNull().default(0),
    activeOrderCount: integer('active_order_count').notNull().default(0),
    totalRevenueCents: bigint('total_revenue_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    totalPayoutCents: bigint('total_payout_cents', { mode: 'bigint' }).notNull().default(sql`0`),

    // Metadata
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    ...timestamps(),
  },
  (t) => [
    index('vendors_status_idx').on(t.status),
    index('vendors_created_at_idx').on(t.createdAt),
    index('vendors_email_idx').on(t.email),
  ],
);

/**
 * Vendor membership — kullanıcı ↔ vendor many-to-many.
 * Bir kullanıcı birden fazla vendor'da role sahibi olabilir.
 */
export const vendorMemberships = pgTable(
  'vendor_memberships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    role: membershipRole('role').notNull().default('staff'),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.vendorId] }),
    index('memberships_vendor_idx').on(t.vendorId),
  ],
);

/**
 * KYC evrakları (vergi levhası, imza sirküleri, ticaret sicil vs.)
 * Storage path Supabase / S3 bucket'ında.
 */
export const kycDocumentType = pgEnum('kyc_document_type', [
  'tax_certificate',     // Vergi levhası
  'signature_circular',  // İmza sirküleri
  'trade_registry',      // Ticaret sicil gazetesi
  'identity_card',       // Kimlik (gerçek kişi vendor için)
  'iban_certificate',    // IBAN belgesi
  'contract_signed',     // İmzalı sözleşme
  'other',
]);

export const kycStatus = pgEnum('kyc_status', [
  'pending',
  'approved',
  'rejected',
  'expired',
]);

export const vendorKycDocuments = pgTable(
  'vendor_kyc_documents',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    docType: kycDocumentType('doc_type').notNull(),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    fileSizeBytes: integer('file_size_bytes'),
    mimeType: text('mime_type'),
    status: kycStatus('status').notNull().default('pending'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('kyc_vendor_idx').on(t.vendorId),
    index('kyc_status_idx').on(t.status),
    unique('kyc_vendor_doc_active_uq').on(t.vendorId, t.docType),
  ],
);
