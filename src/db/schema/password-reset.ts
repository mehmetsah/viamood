/**
 * "Şifremi unuttum" tek kullanımlık token tablosu.
 * Migration: drizzle/0024_password_reset.sql
 *
 * Linkteki ham token burada TUTULMAZ — yalnız SHA-256 özeti (`tokenHash`).
 * `userId` NULL olabilir: kayıtsız e-posta için de satır yazılır ki oran sınırı
 * çalışsın ve "bu e-posta kayıtlı mı" bilgisi davranış farkından SIZMASIN.
 */
import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from './_shared';
import { users } from './auth';

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    requestIp: text('request_ip'),
    createdAt: createdAt(),
  },
  (t) => [index('password_reset_tokens_email_created_idx').on(t.email, t.createdAt)],
);
