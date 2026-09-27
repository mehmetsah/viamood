/**
 * MAİL GÖNDERİM GEÇMİŞİ + ABONELİKTEN ÇIKMA — #991691 (Yunus, 27 Eyl 2026).
 *
 * İKİ TABLO, İKİ AYRI İŞ:
 *  1) `mail_log`  → kime, ne zaman, hangi şablon, başarılı mı. Admin'de
 *     "Mail Gönderim Geçmişi" sayfası bunu okur.
 *  2) `mail_abonelik_cikis` → "bu tür e-postaları almak istemiyorum" diyenler.
 *     Pazarlama/duyuru gönderimi bu listeye BAKMAK ZORUNDA (KVKK).
 *
 * ⚠ ÖLÇÜLDÜ (27 Eyl 2026): bu depoda mail gönderimi için HİÇBİR log tutulmuyordu
 * (`mailLog|email_log|mail_log` araması 0) ve şablonlarda abonelik çıkış linki
 * YOKTU (`unsubscribe|abonelik` araması 0, 9 şablonun hiçbirinde). Yani "kime ne
 * gönderdik" sorusunun cevabı hiçbir yerde durmuyordu.
 *
 * NOT: `schema/index.ts` barrel'ına BİLEREK eklenmedi — `veri-silme` ve `reviews`
 * ile aynı desen; paralel dallarda barrel çakışması bu deponun ölçülmüş sınıfı.
 * Tüketiciler doğrudan '@/db/schema/mail-log' import eder.
 */
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Mail tipi — ZORUNLULUK BURADAN TÜRETİLİR.
 *
 * `pazarlama` ve `duyuru`: abonelik çıkış linki **ZORUNLU** ve gönderim öncesi
 * çıkış listesi kontrol edilir.
 * `islemsel`: sipariş onayı, kargo, şifre sıfırlama, bayi durumu — kullanıcının
 * kendi işleminin sonucu. Çıkış linki opsiyonel, çıkış listesi bu tipi ENGELLEMEZ;
 * engellerse müşteri kendi siparişinin bilgisini alamaz (yasal olarak da gerekmez).
 */
export const MAIL_TIPLERI = ['islemsel', 'pazarlama', 'duyuru'] as const;
export type MailTipi = (typeof MAIL_TIPLERI)[number];

export const mailLog = pgTable(
  'mail_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Alıcı e-posta (tek kayıtta tek alıcı — çoklu gönderim satır satır yazılır). */
    alici: text('alici').notNull(),
    konu: text('konu').notNull(),
    /** Şablon adı — ör. 'welcomeDiscountEmail'. Serbest metin değil, kodun verdiği ad. */
    sablon: text('sablon').notNull().default('bilinmiyor'),
    tip: text('tip').notNull().default('islemsel'),
    /** true = sağlayıcı kabul etti. Teslim garantisi DEĞİL, gönderim sonucu. */
    basarili: boolean('basarili').notNull(),
    /** 'resend' | 'smtp' | 'stub' */
    kanal: text('kanal'),
    /** Sağlayıcı hata metni — kısaltılmış, sır taşımaz. */
    hata: text('hata'),
    /** Sağlayıcının verdiği id (varsa) — destek talebinde bunu sorarlar. */
    saglayiciId: text('saglayici_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('mail_log_created_idx').on(t.createdAt),
    index('mail_log_alici_idx').on(t.alici),
    index('mail_log_tip_idx').on(t.tip),
  ],
);

export const mailAbonelikCikis = pgTable(
  'mail_abonelik_cikis',
  {
    /** E-posta ANAHTAR: aynı adres iki kez çıkamaz, tekrar tık hata vermez. */
    email: text('email').primaryKey(),
    /** Hangi tip için çıktı — şimdilik 'hepsi'; ileride tip bazlı ayrılabilir. */
    kapsam: text('kapsam').notNull().default('hepsi'),
    /** Nereden geldi: 'link' (mail alt bilgisi) | 'admin' | 'istek'. */
    kaynak: text('kaynak').notNull().default('link'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('mail_abonelik_cikis_created_idx').on(t.createdAt)],
);
