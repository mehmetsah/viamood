/**
 * OTOMATİK E-POSTA AKIŞLARI — tetik kaydı · zamanlanmış gönderim · kupon (#991676).
 *
 * Üç tablo, üç ayrı soru cevaplar:
 *   1. `eposta_akis_tetikleri`    — "bu kişi için akış NE ZAMAN, NEDEN başladı?"
 *   2. `eposta_akis_gonderimleri` — "hangi adım ne zaman gidecek / gitti?"
 *   3. `eposta_kuponlari`         — "bu kişiye özel kod ne, kullanıldı mı, ne zaman ölüyor?"
 *
 * ⚠ NEDEN TEK TABLO DEĞİL: tetik bir kez olur, gönderim 2-3 kez olur, kupon
 * yalnız kuponlu adımda olur. Tek tabloya sıkıştırmak ya boş kolon ormanı ya da
 * aynı tetiği 3 kez kopyalamak demekti; ikincisinde "bu kişiye kaç kupon verdim"
 * sorusu (60 gün freni) sayılamaz hâle gelir.
 *
 * ⚠ KUYRUK DEĞİL, DEFTERDİR. BullMQ işi düşse/iki kez çalışsa bile doğruyu bu
 * tablolar söyler: `(tetik_id, adim)` TEKİLDİR ⇒ aynı adım iki kez gönderilemez.
 * Redis'e güvenip bu kısıtı atlamak, ölçülmüş "çift mail" sınıfını açık bırakırdı.
 */
import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from './_shared';

export const epostaAkisTetikleri = pgTable(
  'eposta_akis_tetikleri',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** hos_geldin | sepet_terki | checkout_terki — bkz. src/lib/eposta-akis.ts AKIS */
    akis: text('akis').notNull(),
    email: text('email').notNull(),
    /** Sepet/checkout terkinde kaynak sepet; hoş geldinde boş. */
    cartId: uuid('cart_id'),
    tetikAni: timestamp('tetik_ani', { withTimezone: true }).notNull().defaultNow(),
    /**
     * İYS onayı — tetik anındaki ANLIK GÖRÜNTÜ, kalıcı müşteri izni DEĞİL.
     * Kalıcı izin kolonu (müşteri bazlı, geri alınabilir) ayrı bir karardır:
     * hukuki kayıt + iptal akışı gerektirir, Faz 1 kapsamında DEĞİL.
     * Onay yoksa SMS adımı e-postaya düşer (kanalSec), adım atlanmaz.
     */
    iysOnayi: boolean('iys_onayi').notNull().default(false),
    /**
     * Akış erken kapandıysa sebebi: 'donusum' (sipariş verdi) | 'abonelik_iptal' | 'elle'.
     * Satır SİLİNMEZ — niçin susulduğu iz olarak kalır (invite_tokens deseni).
     */
    iptalSebebi: text('iptal_sebebi'),
    iptalAni: timestamp('iptal_ani', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('eposta_akis_tetikleri_email_idx').on(t.email, t.tetikAni),
    index('eposta_akis_tetikleri_akis_idx').on(t.akis, t.tetikAni),
  ],
);

export const epostaAkisGonderimleri = pgTable(
  'eposta_akis_gonderimleri',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tetikId: uuid('tetik_id')
      .notNull()
      .references(() => epostaAkisTetikleri.id, { onDelete: 'cascade' }),
    adim: integer('adim').notNull(),
    planlananAn: timestamp('planlanan_an', { withTimezone: true }).notNull(),
    /** planlandi | gonderildi | atlandi | iptal | hata */
    durum: text('durum').notNull().default('planlandi'),
    /** eposta | sms — İYS onayına göre kanalSec() belirler. */
    kanal: text('kanal').notNull().default('eposta'),
    kuponId: uuid('kupon_id'),
    gonderimAni: timestamp('gonderim_ani', { withTimezone: true }),
    hataMetni: text('hata_metni'),
    createdAt: createdAt(),
  },
  (t) => [
    /** ÇİFT MAİL FRENİ — aynı tetiğin aynı adımı iki satır olamaz. */
    unique('eposta_akis_gonderimleri_tetik_adim_uq').on(t.tetikId, t.adim),
    /** Zamanlayıcının taradığı tek indeks: vakti gelmiş planlı satırlar. */
    index('eposta_akis_gonderimleri_planlanan_idx').on(t.durum, t.planlananAn),
  ],
);

export const epostaKuponlari = pgTable(
  'eposta_kuponlari',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** KİŞİYE ÖZEL kod — statik WELCOME_DISCOUNT_CODE'un yerini alır. */
    kod: text('kod').notNull().unique(),
    email: text('email').notNull(),
    akis: text('akis').notNull(),
    indirimYuzde: integer('indirim_yuzde').notNull(),
    /** Üst limit (kuruş) — sepet 1.500 TL'yi aşarsa indirim bu tutarda tavanlanır. */
    ustLimitKurus: integer('ust_limit_kurus'),
    bitisAni: timestamp('bitis_ani', { withTimezone: true }).notNull(),
    /** Damgalanınca kupon ÖLÜR (tek kullanım). Satır silinmez. */
    kullanildiAni: timestamp('kullanildi_ani', { withTimezone: true }),
    kullanilanSiparisId: uuid('kullanilan_siparis_id'),
    createdAt: createdAt(),
  },
  (t) => [
    /** 60 GÜN FRENİ bu indeksle sorulur: bu e-postaya en son ne zaman kupon verdim? */
    index('eposta_kuponlari_email_created_idx').on(t.email, t.createdAt),
  ],
);
