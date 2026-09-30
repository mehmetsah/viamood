/**
 * DAVET (ilk giriş) linki — tek kullanımlık token tablosu.
 *
 * Mehmet'in 30 Eyl 2026 genel kuralı: "parola düz metin paylaşılmaz — link gönderilir,
 * karşı taraf KENDİ parolasını oluşturur, link 24 saat geçerli olur, parola
 * oluşturulunca link silinir."
 *
 * Bu tablo `password_reset_tokens`'ın KARDEŞİDİR — yeni bir güvenlik deseni icat
 * edilmedi, ölçülmüş ve çalışan desen birebir tekrarlandı:
 *   · Linkteki HAM token burada TUTULMAZ, yalnız SHA-256 özeti (`tokenHash`).
 *     DB sızsa bile elindeki özetle geçerli link ÜRETİLEMEZ.
 *   · `expiresAt` — 24 saat (süre koda gömülmedi, üreten taraf yazar).
 *   · `usedAt` — parola belirlendiği an damgalanır ⇒ link ÖLÜR (tek kullanım).
 *
 * ⚠ `usedAt` damgalamak satırı SİLMEKTEN yeğdir: silinen satır "bu link hiç var
 * olmadı" ile "kullanıldı"yı ayırt edilemez kılar ve kötüye kullanım izi kaybolur.
 * Dışarıya dönen YANIT yine de ikisinde de AYNIDIR (bkz. src/lib/davet.ts) — iz
 * içeride kalır, bilgi dışarı sızmaz.
 */
import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from './_shared';
import { users } from './auth';

export const inviteTokens = pgTable(
  'invite_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    /** Davet edilen rolü — SERVER tarafında yazılır, linkten/istemciden ASLA okunmaz. */
    role: text('role').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    requestIp: text('request_ip'),
    createdAt: createdAt(),
  },
  (t) => [index('invite_tokens_email_created_idx').on(t.email, t.createdAt)],
);
