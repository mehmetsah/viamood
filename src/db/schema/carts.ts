import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps, uuidV7 } from './_shared';

/**
 * Native sepet / checkout-taslağı (FAZ 2 Dilim 4 backend).
 *
 * Shopify cart session + `_tr_*` cart-attributes'in RDS karşılığı. Tema (storefront)
 * şimdilik DOKUNMUYOR — bu katman hazır dururken sonradan `/cart.js` yerine bağlanacak.
 * Line item'lar jsonb (Shopify cart.js şekline yakın); fiyat/başlık READ'de RDS'ten türetilir.
 */
export interface CartItem {
  variant_id: string; // Shopify variant id (gid veya numerik) — RDS'te shopify_variant_id ile eşleşir
  quantity: number;
}

export const carts = pgTable(
  'carts',
  {
    id: uuidV7('id'),
    token: text('token').notNull().unique(), // client tarafında saklanan sepet anahtarı
    customerId: text('customer_id'), // giriş yapmışsa Shopify/RDS müşteri ref
    items: jsonb('items').$type<CartItem[]>().notNull().default([]),
    // checkout alanları: first_name, phone, il, ilce, mahalle, address1, invoice_type, payment_method, discount_code, ...
    attributes: jsonb('attributes').$type<Record<string, string>>().notNull().default({}),
    note: text('note'),
    status: text('status').notNull().default('active'), // active | converted | abandoned
    convertedOrderId: uuid('converted_order_id'),
    ...timestamps(),
  },
  (t) => [
    index('carts_status_idx').on(t.status),
    index('carts_customer_idx').on(t.customerId),
  ],
);
