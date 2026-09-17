import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Mağaza ödeme ayarları (admin'den yönetilir). */
export interface PaymentSettings {
  iyzico_enabled?: boolean;
  paytr_enabled?: boolean;
  halkode_enabled?: boolean;
  havale_enabled?: boolean;
  cod_enabled?: boolean;
  card_gateway?: 'iyzico' | 'paytr' | 'halkode'; // kart için aktif gateway
  cod_card_surcharge_pct?: number; // kapıda kart komisyonu (%)
  paytr_merchant_id?: string;
  paytr_merchant_key?: string;
  paytr_merchant_salt?: string;
  paytr_test_mode?: number;
  iyzico_api_key?: string;
  iyzico_secret_key?: string;
  iyzico_test_mode?: number;
  // Halköde (Halkbank) sanal POS — test modu 1 iken testapp.halkode.com.tr,
  // 0 iken app.halkode.com.tr kullanılır (bkz. lib/halkode/client.ts).
  halkode_app_id?: string;
  halkode_app_secret?: string;
  halkode_merchant_key?: string;
  halkode_test_mode?: number;
  // ── Halköde CANLI kimlikleri — TEST yuvalarından AYRI ────────────────────
  // Tek yuva olsaydı canlı anahtarları girmek test sayfasını sessizce bozardı
  // (test sayfası testapp'e gider, elinde canlı kimlik olurdu → status 30).
  // Ayrı yuva sayesinde test ve canlı deneme sayfaları yan yana yaşar.
  halkode_live_app_id?: string;
  halkode_live_app_secret?: string;
  halkode_live_merchant_key?: string;
  /**
   * CANLI deneme sayfasının (gizli link) kill switch'i. KAPALIYKEN canlı
   * önizleme çerezi hiçbir şey açmaz — elde kalan link o an ölür, deploy
   * gerekmez. Müşteri akışını açan `halkode_enabled` ile KARIŞTIRILMAMALI:
   * bu yalnız gizli linki yönetir, vitrinde hiçbir şey göstermez.
   */
  halkode_canli_deneme?: boolean;
}

/**
 * Sosyal giriş (OAuth) ayarları — admin panelinden yönetilir.
 *
 * NEDEN DB'DE: prod sunucuya SSH kapalı, .env düzenlenemiyor. Kimlikler
 * panelden girilsin diye burada tutulur. ENV VARSA ENV ÖNCELİKLİ (bkz.
 * lib/auth/social.ts) — geriye dönük uyumluluk bozulmaz.
 *
 * `google_client_secret` API'den ASLA düz dönmez; yalnız maskeli özet gösterilir.
 */
export interface AuthSettings {
  google_enabled?: boolean;
  google_client_id?: string;
  google_client_secret?: string;
  /** Facebook için yer ayrıldı; kimlik yokken giriş ekranında GÖSTERİLMEZ. */
  facebook_enabled?: boolean;
  facebook_client_id?: string;
  facebook_client_secret?: string;
}

/** Mağaza kargo ayarları. */
export interface ShippingSettings {
  free_shipping_all?: boolean; // true → TÜM siparişlerde kargo ÜCRETSİZ (eşik/marj yok sayılır)
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
  // /admin/theme section editöründen düzenlenir (sıralı anasayfa bölümleri)
  homeSections?: unknown[]; // HomeSection[] (lib/storefront/sections)
  // İçerik sayfaları override'ı (slug → {title, html})
  pages?: Record<string, { title?: string; html?: string }>;
  // Mega-menü (üst nav) — /admin/theme menü editöründen (NavItem[])
  menu?: unknown[];
  // Footer link sütunları (heading + links) — /admin/theme footer editöründen
  footerCols?: { heading: string; links: { label: string; url: string }[] }[];
  // Footer marka/iletişim bilgileri
  footer_desc?: string;
  footer_phone?: string;
  footer_email?: string;
  footer_address?: string;
  footer_instagram?: string;
}

/**
 * Tekil mağaza ayarları (id='default'). Storefront ödeme/kargo/tema + altyapı switch'i besler.
 */
export const storeSettings = pgTable('store_settings', {
  id: text('id').primaryKey().default('default'),
  // Altyapı switch'i: 'shopify' (sipariş Shopify'a) | 'native' (sipariş RDS'e). getStore() bunu okur.
  backend: text('backend').notNull().default('shopify'),
  payment: jsonb('payment').$type<PaymentSettings>().notNull().default({}),
  auth: jsonb('auth').$type<AuthSettings>().notNull().default({}),
  shipping: jsonb('shipping').$type<ShippingSettings>().notNull().default({}),
  theme: jsonb('theme').$type<ThemeSettings>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
