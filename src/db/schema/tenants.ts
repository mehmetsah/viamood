/**
 * Tenant registry — multi-instance (marka başına ayrı kurulum) kontrol düzlemi.
 *
 * Mimari karar (2026-07-22): kod TEK repo; her marka AYRI instance (env+DB+process).
 * Bu tablo yalnız ANA (kontrol) instance'ta anlamlıdır: markaların envanterini tutar,
 * /admin/tenants paneli buradan sağlık/sürüm izler. Tenant verisi (sipariş/ürün)
 * BURADA DEĞİL, her markanın kendi DB'sindedir — izolasyon bilinçli.
 *
 * NOT: schema/index.ts barrel'ına bilerek EKLENMEDİ (yan çalışma alanıyla çakışmamak
 * için); tüketiciler doğrudan '@/db/schema/tenants' import eder.
 */
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Görünen marka adı — ör. "Via Mood" */
    name: text('name').notNull(),
    /** URL-güvenli benzersiz kimlik — ör. "viamood" */
    slug: text('slug').notNull().unique(),
    /** Müşteri storefront domain'i — ör. https://viamood.com.tr */
    storefrontUrl: text('storefront_url').notNull(),
    /** Vendor-platform instance kökü (health/sürüm buradan) — ör. http://13.62.159.252 */
    appUrl: text('app_url'),
    /** Shopify mağaza domain'i — ör. d3z34m-iw.myshopify.com */
    shopifyDomain: text('shopify_domain'),
    /** Instance'ın kendi Postgres database adı (envanter amaçlı, bağlantı DEĞİL) */
    dbName: text('db_name'),
    /** provisioning: kuruluyor · active: canlı · disabled: durduruldu */
    status: text('status').notNull().default('provisioning'),
    /** Serbest yapılandırma notları (IBAN sahibi, tema id, KargoLab member vb.) */
    config: jsonb('config').$type<Record<string, string>>().default({}),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tenants_status_idx').on(t.status)],
);

export type Tenant = typeof tenants.$inferSelect;
