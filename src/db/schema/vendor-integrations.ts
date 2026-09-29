import { sql } from 'drizzle-orm';
import { index, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './_shared';
import { users } from './auth';
import { vendors } from './vendors';

/**
 * FAZ 2 — Tedarikçi pazaryeri entegrasyon bağlantıları (kredensiyel deposu).
 *
 * Her vendor kendi pazaryeri mağazasını admin panelinden BAĞLAR (self-service) —
 * Via Mood bu sayede KargoLab prod DB'sine bağımlı DEĞİL. Test kaynağı: member_id=30
 * Trendyol mağazası; prod: Halil İbrahim vb. aynı ekranı kullanır.
 *
 * GÜVENLİK: apiKey/secretKey düz metin TUTULMAZ — `credentialEnc` alanında
 * AES-256-GCM ile şifreli JSON saklanır (src/lib/crypto/secretbox). supplierId gizli
 * değil, ayrı sütunda. Çözme yalnızca sunucu tarafında (server action / job).
 */

export const integrationProvider = pgEnum('integration_provider', ['trendyol']);

export const integrationStatus = pgEnum('integration_status', [
  'disconnected', // kaydedildi ama henüz test edilmedi
  'connected',    // son test başarılı
  'error',        // son test hata verdi (lastError)
]);

export const vendorIntegrations = pgTable(
  'vendor_integrations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),

    provider: integrationProvider('provider').notNull(),

    /** Trendyol satıcı ID (gizli değil). */
    externalSupplierId: text('external_supplier_id').notNull(),

    /** {apiKey, secretKey} → AES-256-GCM şifreli (iv:tag:cipher base64). Düz metin ASLA. */
    credentialEnc: text('credential_enc').notNull(),

    status: integrationStatus('status').notNull().default('disconnected'),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true, mode: 'date' }),
    lastError: text('last_error'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true, mode: 'date' }),
    /** Son testte/senkronda görülen ürün sayısı (kaba gösterge). */
    productCount: integer('product_count'),

    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    // Bir vendor + provider = tek bağlantı.
    vendorProviderUq: unique('vendor_integrations_vendor_provider_uq').on(t.vendorId, t.provider),
    vendorIdx: index('vendor_integrations_vendor_idx').on(t.vendorId),
  }),
);
