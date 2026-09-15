/**
 * "Hoş geldin" pop-up form kayıtları (Defter #974).
 * Migration: drizzle/0022_welcome_signups.sql
 *
 * KVKK: bu tablo açık rızanın ispatıdır — onayın verildiği ANDAKİ metin
 * (`consentText`), zaman, kaynak sayfa, UTM ve istemci bilgisi birlikte saklanır.
 * Onay metni ileride değişse bile eski kayıtlar kendi metniyle kalmalıdır.
 */
import { sql } from 'drizzle-orm';
import { bigint, boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from './_shared';

export const welcomeSignups = pgTable(
  'welcome_signups',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    email: text('email').notNull(),
    /** Kullanıcının yazdığı hâli (ispat için ham girdi korunur). */
    phone: text('phone').notNull(),
    /** Normalize edilmiş hâl: +90XXXXXXXXXX */
    phoneE164: text('phone_e164'),

    consent: boolean('consent').notNull().default(false),
    /** Onay kutusunun O ANDAKİ tam metni. */
    consentText: text('consent_text').notNull(),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull().defaultNow(),

    sourceUrl: text('source_url'),
    referrer: text('referrer'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmTerm: text('utm_term'),
    utmContent: text('utm_content'),

    requestIp: text('request_ip'),
    userAgent: text('user_agent'),

    /** pending → sent | failed | skipped (mail kanalı yapılandırılmamış) */
    emailStatus: text('email_status').notNull().default('pending'),
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
    emailError: text('email_error'),

    shopifyCustomerId: bigint('shopify_customer_id', { mode: 'number' }),

    createdAt: createdAt(),
  },
  (t) => [
    index('welcome_signups_email_idx').on(t.email),
    index('welcome_signups_created_idx').on(t.createdAt),
    index('welcome_signups_ip_created_idx').on(t.requestIp, t.createdAt),
  ],
);
