import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Mağaza ödeme ayarları (admin'den yönetilir). */
export interface PaymentSettings {
  iyzico_enabled?: boolean;
  paytr_enabled?: boolean;
  havale_enabled?: boolean;
  cod_enabled?: boolean;
  card_gateway?: 'iyzico' | 'paytr'; // kart için aktif gateway
  cod_card_surcharge_pct?: number; // kapıda kart komisyonu (%)
}

/** Mağaza kargo ayarları. */
export interface ShippingSettings {
  free_shipping_threshold?: number; // TL — üstünde kargo ücretsiz (0/boş = yok)
  default_courier?: string;
  shipping_margin_tl?: number; // KargoLab fiyatına eklenen sabit marj (TL)
}

/**
 * Tekil mağaza ayarları (id='default'). Storefront ödeme/kargo seçenekleri buradan beslenir.
 */
export const storeSettings = pgTable('store_settings', {
  id: text('id').primaryKey().default('default'),
  payment: jsonb('payment').$type<PaymentSettings>().notNull().default({}),
  shipping: jsonb('shipping').$type<ShippingSettings>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
