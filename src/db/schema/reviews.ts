import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';

/**
 * Product / store reviews — müşteri yorumları (moderasyonlu). CANLI.
 * Migration: drizzle/0014_reviews.sql (elle, idempotent; deploy.sh listesinde).
 *
 * Akış: storefront formu POST /api/v1/storefront/reviews → status='pending'
 *       → admin /admin/reviews onaylar → status='approved' → anasayfada görünür.
 *
 * Doğrulanmış alıcı: e-posta `customers`/`orders` ile eşleşiyorsa verified=true
 * (FK YOK — canlı orders tablosuna dokunmamak için uygulama katmanında eşlenir,
 *  customerAddresses köprüsüyle aynı desen).
 */
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    // Kaynak: 'customer' = storefront formundan, 'seed' = Göknil kartından elle.
    source: text('source').notNull().default('customer'),

    // Moderasyon durumu: 'pending' | 'approved' | 'rejected'
    status: text('status').notNull().default('pending'),

    // Yorum içeriği
    authorName: text('author_name').notNull(),
    location: text('location'),
    rating: integer('rating').notNull().default(5), // 1..5 (uygulama katmanında sınırlandırılır)
    body: text('body').notNull(),

    // Opsiyonel ürün bağlamı + görsel
    productTitle: text('product_title'),
    productHandle: text('product_handle'),
    imageUrl: text('image_url'), // yüklenen/harici görsel (S3 veya Shopify Files)

    // Doğrulama / iz
    verifiedBuyer: boolean('verified_buyer').notNull().default(false),
    customerEmail: text('customer_email'), // eşleme için (public API'de DÖNDÜRÜLMEZ)
    orderName: text('order_name'), // eşleşen sipariş no (#1044 vb.)
    sourceImage: text('source_image'), // seed için: KOPYA.jpg gibi kaynak kart dosyası

    // Moderasyon izi
    ipHash: text('ip_hash'), // spam/rate-limit için (ham IP saklanmaz)
    moderatedBy: text('moderated_by'),
    moderatedAt: text('moderated_at'),

    ...timestamps(),
  },
  (t) => [
    index('reviews_status_idx').on(t.status),
    index('reviews_created_idx').on(t.createdAt),
    index('reviews_email_idx').on(t.customerEmail),
  ],
);

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
