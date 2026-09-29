import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Kullanıcı yetkileri — role ENUM'una dokunmadan yetki vermenin geri alınabilir yolu.
 * `users.role` enum olduğu için oraya eklenen değer silinemez; burada tek DELETE yeter.
 */
export const userYetkileri = pgTable(
  'user_yetkileri',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    yetki: text('yetki').notNull(),
    verildiAt: timestamp('verildi_at', { withTimezone: true }).notNull().defaultNow(),
    verenUserId: uuid('veren_user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({
    uniq: unique('user_yetkileri_uniq').on(t.userId, t.yetki),
    userIdx: index('user_yetkileri_user_idx').on(t.userId),
    yetkiIdx: index('user_yetkileri_yetki_idx').on(t.yetki),
  }),
);
