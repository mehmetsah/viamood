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

/** Tema/vitrin görünüm ayarları (ayar-tabanlı tema editörü). */
export interface ThemeSettings {
  brand_primary?: string; // vurgu rengi (hex) — butonlar/fiyat
  brand_ink?: string; // koyu renk (hex) — header/footer
  announcement?: string; // üst duyuru çubuğu metni
  announcement_enabled?: boolean;
  hero_title?: string;
  hero_subtitle?: string;
  hero_image?: string; // hero banner görsel URL
  hero_cta_text?: string;
  hero_cta_link?: string;
  footer_text?: string;
}

/**
 * Tekil mağaza ayarları (id='default'). Storefront ödeme/kargo/tema + altyapı switch'i besler.
 */
export const storeSettings = pgTable('store_settings', {
  id: text('id').primaryKey().default('default'),
  // Altyapı switch'i: 'shopify' (sipariş Shopify'a) | 'native' (sipariş RDS'e). getStore() bunu okur.
  backend: text('backend').notNull().default('shopify'),
  payment: jsonb('payment').$type<PaymentSettings>().notNull().default({}),
  shipping: jsonb('shipping').$type<ShippingSettings>().notNull().default({}),
  theme: jsonb('theme').$type<ThemeSettings>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
