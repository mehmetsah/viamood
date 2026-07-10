import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { users } from './auth';

/**
 * Customers — Via Mood müşterileri (storefront alıcıları).
 *
 * FAZ 1: müşteri kimliği + adres defteri RDS'e taşınır (önceden yalnızca Shopify'daydı).
 * Kimlik köprüsü = EMAIL (+ opsiyonel shopifyCustomerId). `orders` tablosuna FK YOK
 * (orders.customerId text/Shopify ID; 5583 satırlık canlı tabloya dokunulmaz).
 * Portal sorgusu: lower(customers.email) = lower(orders.customerEmail)
 *   (veya orders.customerId = customers.shopifyCustomerId).
 *
 * `userId`: NextAuth users satırı (müşteri portal'a kayıt olduysa). Portal'a kayıtsız ama
 * sipariş veren müşteride NULL kalır (backfill/webhook'tan gelir). Kayıt olunca D1'de bağlanır.
 */
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    shopifyCustomerId: text('shopify_customer_id'),
    // email = ana köprü; uygulama katmanında daima lowercase+trim yazılır.
    email: text('email').notNull(),
    name: text('name'),
    phone: text('phone'),
    // Bildirim tercihleri (portal Profil ekranı)
    preferences: jsonb('preferences')
      .$type<{ campaign?: boolean; sms?: boolean; whatsapp?: boolean }>()
      .notNull()
      .default({}),
    ...timestamps(),
  },
  (t) => [
    unique('customers_email_uniq').on(t.email),
    index('customers_shopify_idx').on(t.shopifyCustomerId),
    index('customers_user_idx').on(t.userId),
  ],
);

/**
 * Customer addresses — yapılandırılmış adres defteri.
 *
 * Strateji şartı: il/ilçe/mahalle AYRI kolon (Shopify native TR formunda yok).
 *   province = il, district = ilçe, neighborhood = mahalle, address1 = açık adres.
 *
 * ⚠️ orders.shippingAddress jsonb'da isimlendirme TERS (order-ingest.ts:187-188):
 *   shippingAddress.district = il, shippingAddress.city = ilçe, shippingAddress.address2 = mahalle.
 *   Backfill/dual-write eşlemesinde tersine çevrilir.
 */
export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    label: text('label'), // "Ev", "İş" vs.
    firstName: text('first_name'),
    lastName: text('last_name'),
    phone: text('phone'),
    province: text('province'), // il
    district: text('district'), // ilçe
    neighborhood: text('neighborhood'), // mahalle
    address1: text('address1'), // açık adres
    postalCode: text('postal_code'),
    isDefault: boolean('is_default').notNull().default(false),
    shopifyAddressId: text('shopify_address_id'), // Shopify sync (checkout selector)
    ...timestamps(),
  },
  (t) => [
    index('cust_addr_customer_idx').on(t.customerId),
    // Defansif dedup; asıl dedup uygulama katmanında (customer-address.ts deseni, null-safe).
    unique('cust_addr_dedup_uniq').on(
      t.customerId,
      t.address1,
      t.district,
      t.province,
      t.neighborhood,
      t.postalCode,
    ),
  ],
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerAddress = typeof customerAddresses.$inferSelect;
export type NewCustomerAddress = typeof customerAddresses.$inferInsert;
