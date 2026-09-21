import { bigint, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { orders } from './orders';

/**
 * KART İADESİ İŞLEM KAYDI (Halköde/PayTR/İyzico).
 *
 * Neden ayrı tablo: `returns` MÜŞTERİ İADE TALEBİDİR (hangi ürün, kargo kodu,
 * PTT şubesi). Burası PARA hareketidir — gateway'e gönderilen iade isteğinin
 * kendisi ve bankanın cevabı. Biri olmadan diğeri olabilir: müşteri ürün
 * iadesi açmadan da iade yapılabilir (yanlış tahsilat), ürün iadesi para
 * iadesi olmadan da kapanabilir (havale ile geri ödeme).
 *
 * ⚠️ 17 Eyl 2026 dersi: para hareketi olup sistemde İZ KALMAMASI en pahalı
 * arızaydı (10 TL çekildi, sipariş açılmadı, üç gün teşhis sürdü). Bu tablo
 * ekleme-only çalışır: her deneme — başarısız olanlar dahil — satır bırakır.
 * Böylece "para gitti mi?" sorusu bir daha log aramakla cevaplanmaz.
 */
export const paymentRefunds = pgTable(
  'payment_refunds',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    /** Sipariş adı/no — order silinse de kayıt anlamını korusun. */
    orderName: text('order_name'),
    /** Gateway'deki işlem kimliği (Halköde: invoice_id). İade bununla yapılır. */
    invoiceId: text('invoice_id').notNull(),
    /** halkode | paytr | iyzico */
    gateway: text('gateway').notNull().default('halkode'),
    /** Kuruş cinsinden — TL float'ı para hesabında kullanılmaz. */
    amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
    /** pending → success | failed. pending satırı "istek gitti, cevap yok" demektir. */
    status: text('status').notNull().default('pending'),
    /** Gateway'in uygulama durum kodu (Halköde: 100 başarı, 49 iade başarısız). */
    statusCode: text('status_code'),
    /** Gateway'in açıklaması — kullanıcıya gösterilen hata metni buradan gelir. */
    description: text('description'),
    /** Ham cevap (teşhis için). ⚠️ Sır alanı YAZILMAZ — merchant_key/app_secret asla. */
    raw: jsonb('raw'),
    /** İadeyi tetikleyen admin kullanıcısı (e-posta/isim) — kim yaptı sorusu. */
    requestedBy: text('requested_by'),
    /** Operatörün serbest notu (ör. "müşteri yanlış ürün aldı"). */
    note: text('note'),
    /** Shopify siparişine not düşüldü mü — çift not yazmayı önler. */
    shopifyNoted: text('shopify_noted'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('payment_refunds_order_idx').on(t.orderId),
    index('payment_refunds_invoice_idx').on(t.invoiceId),
    index('payment_refunds_status_idx').on(t.status),
  ],
);

export type PaymentRefund = typeof paymentRefunds.$inferSelect;
export type NewPaymentRefund = typeof paymentRefunds.$inferInsert;
