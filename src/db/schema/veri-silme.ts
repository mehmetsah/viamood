/**
 * Facebook (Meta) veri silme talepleri — 0026_veri_silme.sql karşılığı.
 *
 * Meta "Data Deletion Request Callback" protokolünün kaydı: her talep bir
 * confirmation_code (kod) alır, /veri-silme-durumu?kod=… sayfası buradan okur.
 *
 * NOT: schema/index.ts barrel'ına bilerek EKLENMEDİ (reviews/tenants ile aynı
 * desen — paralel dallarla merge çakışmasını önler); tüketiciler doğrudan
 * '@/db/schema/veri-silme' import eder.
 */
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const veriSilmeTalepleri = pgTable(
  'veri_silme_talepleri',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Meta'ya dönülen confirmation_code — durum sayfasının anahtarı. */
    kod: text('kod').notNull().unique(),
    provider: text('provider').notNull().default('facebook'),
    /** Facebook app-scoped user id (signed_request.user_id). */
    providerUserId: text('provider_user_id').notNull(),
    /** Bizdeki kullanıcı (accounts eşleşmesi bulunduysa). */
    userId: text('user_id'),
    /** alindi → baglanti-silindi | kayit-bulunamadi | imza-dogrulanamadi */
    durum: text('durum').notNull().default('alindi'),
    detay: text('detay'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('veri_silme_provider_user_idx').on(t.provider, t.providerUserId)],
);

export type VeriSilmeTalebi = typeof veriSilmeTalepleri.$inferSelect;
