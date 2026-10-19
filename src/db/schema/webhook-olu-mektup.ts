/**
 * SHOPIFY WEBHOOK ÖLÜ MEKTUP KUTUSU (#994753 · R1).
 *
 * ⚠ NEDEN VAR: webhook ucu bir siparişi işleyemediğinde iki yanlış seçenek
 * arasında sıkışmıştı:
 *   · HTTP 200 dönmek  ⇒ Shopify "başardı" sanar, bir daha denemez, sipariş
 *     SESSİZCE KAYBOLUR (19 Eki 2026 ölçümü: dış `catch` tüm istisnalarda
 *     200 dönüyordu, yani her DB tıkanması bir siparişi yok ediyordu).
 *   · HTTP 503 dönmek  ⇒ Shopify yeniden dener; ama hata KALICIYSA (şema
 *     doğrulaması düşmüş, line_items boş) deneme hiç başarmaz ve Shopify
 *     ~48 saat sonra ABONELİĞİ DEVRE DIŞI BIRAKIR — o andan sonra HİÇBİR
 *     sipariş düşmez. Bir siparişi kaybetmek yerine hepsini kaybetmek olurdu.
 *
 * Çözüm iki parçalı: yanıt kodu hatanın TİPİNE göre seçilir (kalıcı → 200,
 * geçici → 503) ve HER İKİ hâlde ham gövde BURAYA yazılır. Böylece yanıt kodu
 * ne olursa olsun veri kaybı yoktur; kalıcı hata elle/toplu yeniden işlenebilir.
 *
 * ⚠ BU BİR KUYRUK DEĞİL, DEFTERDİR: `islendi_ts` damgası dolana kadar kayıt
 * açıktır. Yeniden işleyici (replay) ayrı bir karardır ve bu tabloya bakar.
 */
import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const webhookOluMektup = pgTable(
  'webhook_olu_mektup',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** x-shopify-topic — ör. orders/create */
    konu: text('konu').notNull(),
    /** x-shopify-webhook-id; Shopify yeniden denemelerde AYNI değeri gönderir. */
    webhookId: text('webhook_id'),
    shopDomain: text('shop_domain'),
    /**
     * true  = kalıcı hata (şema/doğrulama) ⇒ uç 200 döndü, Shopify tekrar DENEMEZ.
     * false = geçici hata (DB/ağ)          ⇒ uç 503 döndü, Shopify tekrar DENER.
     * Kayıt iki hâlde de yazılır; bu kolon yalnız "kim yeniden denemekle yükümlü"
     * sorusunu cevaplar.
     */
    kalici: boolean('kalici').notNull(),
    hata: text('hata').notNull(),
    /** Ham istek gövdesi — tavanla kırpılır (bkz. src/lib/shopify/olu-mektup.ts). */
    hamGovde: text('ham_govde'),
    /** Elle/toplu yeniden işlenince damgalanır; NULL = hâlâ açık. */
    islendiTs: timestamp('islendi_ts', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    konuIdx: index('webhook_olu_mektup_konu_idx').on(t.konu),
    acikIdx: index('webhook_olu_mektup_acik_idx').on(t.islendiTs),
  }),
);
