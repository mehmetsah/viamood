/**
 * ÜRÜN SSS (sıkça sorulan sorular) — #991833 (Yunus, 27 Eyl 2026 23:16).
 *
 * Ürün detay sayfasındaki accordion'a "Sıkça Sorulan Sorular" sekmesi eklenecek ve
 * her ürünün kendi soru-cevap çiftleri olacak. Bu tablo o çiftleri tutar.
 *
 * ÖLÇÜLEN YAPI (canlı ürün sayfası, 27 Eyl): tema `<accordion-custom><details>` +
 * `<summary class="details__header">` deseniyle üç sekme çiziyor (Ürün detayları ·
 * Kargo · İade). SSS dördüncü ve EN SON sekme olarak aynı desenle eklenir.
 *
 * ÜRÜN ANAHTARI `handle` — sayısal id DEĞİL. Gerekçe ölçüldü: Shopify teması
 * ürünü `handle` ile tanır (`/products/<handle>`), native vitrin de
 * `magaza/[handle]` ile. Sayısal id seçilse tema tarafı her istekte id↔handle
 * çevirimi yapmak zorunda kalırdı ve Shopify↔native id ayrışması (gid vs numerik)
 * bu depoda ölçülmüş bir çift-kayıt sınıfıdır.
 *
 * NOT: `schema/index.ts` barrel'ına BİLEREK eklenmedi — veri-silme/reviews/mail-log
 * ile aynı desen; paralel dallarda barrel çakışması ölçülmüş bir sınıf.
 */
import { boolean, index, integer, pgTable, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';

export const urunSss = pgTable(
  'urun_sss',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Ürün handle — `/products/<handle>`. Küçük harf, boşluksuz. */
    urunHandle: text('urun_handle').notNull(),
    soru: text('soru').notNull(),
    cevap: text('cevap').notNull(),
    /** Görünüm sırası — küçük olan üstte. Aynı ürün içinde tekil. */
    sira: integer('sira').notNull().default(0),
    /** Kapalıysa ekranda görünmez; silmeden gizlemek için. */
    acik: boolean('acik').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('urun_sss_handle_idx').on(t.urunHandle),
    /** Aynı üründe iki kayıt aynı sırada duramaz — ekran sırası belirsiz kalmasın. */
    unique('urun_sss_handle_sira_uq').on(t.urunHandle, t.sira),
  ],
);

export type UrunSss = typeof urunSss.$inferSelect;
