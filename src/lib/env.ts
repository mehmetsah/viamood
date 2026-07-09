import { z } from 'zod';

/**
 * Zod-validated environment variables.
 * Hata veriyorsa boot'ta erken patlar (silent prod sürprizi yok).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Auth
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 chars'),
  AUTH_URL: z.string().url().default('http://localhost:3000'),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_APPLE_ID: z.string().optional(),
  AUTH_APPLE_SECRET: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Via Mood <noreply@viamood.com>'),

  // Storefront — primary domain (custom checkout ödeme redirect'i + CORS default origin). Domain değişince TEK yer.
  STOREFRONT_URL: z.string().url().default('https://viamood.com.tr'),

  // FAZ 2 strangler flag — sipariş oluşturma backend'i. Production 'shopify' kalır; 'native' RDS'e yazar.
  STORE_BACKEND: z.enum(['shopify', 'native']).default('shopify'),

  // Shopify
  SHOPIFY_STORE_DOMAIN: z.string(),
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().optional(), // legacy, custom app fallback
  SHOPIFY_API_VERSION: z.string().default('2025-01'),
  SHOPIFY_WEBHOOK_SECRET: z.string().optional(),
  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  SHOPIFY_SCOPES: z.string().default('read_products,write_products,read_orders,write_orders,read_inventory,write_inventory,read_fulfillments,write_fulfillments,read_customers,write_customers,read_locations,read_shipping,write_shipping,read_themes,write_themes,write_content,read_content,write_discounts,read_discounts,write_marketing_events,read_marketing_events,write_price_rules,read_price_rules'),

  // Iyzico
  IYZICO_API_KEY: z.string().optional(),
  IYZICO_SECRET_KEY: z.string().optional(),
  IYZICO_BASE_URL: z.string().url().default('https://sandbox-api.iyzipay.com'),
  IYZICO_CALLBACK_BASE: z.string().url().default('http://localhost:3000'),
  IYZICO_DEFAULT_SUBMERCHANT_KEY: z.string().optional(),

  // PayTR (iFrame API) — İyzico'ya paralel kart gateway
  PAYTR_MERCHANT_ID: z.string().optional(),
  PAYTR_MERCHANT_KEY: z.string().optional(),
  PAYTR_MERCHANT_SALT: z.string().optional(),
  PAYTR_TEST_MODE: z.coerce.number().default(1), // 1=test, 0=canlı

  // KargoLab
  KARGOLAB_API_URL: z.string().url().default('https://kargolab.com/api/v1'),
  KARGOLAB_HOST_HEADER: z.string().default('kargolab.com'),
  KARGOLAB_USER_EMAIL: z.string().email().optional(),
  KARGOLAB_USER_PASSWORD: z.string().optional(),
  KARGOLAB_MEMBER_ID: z.coerce.number().optional(),
  KARGOLAB_API_KEY: z.string().optional(), // legacy

  // Mikro V17 ERP
  MIKRO_API_URL: z.string().url().optional(),         // örn. http://85.111.96.204:7781/api
  MIKRO_USERNAME: z.string().optional(),
  MIKRO_PASSWORD: z.string().optional(),
  /** Sipariş onaylama userId (Mikro tarafı verir) */
  MIKRO_APPROVER_USER_NO: z.coerce.number().default(1),
  /** Project code: SHOPIFY / WOO / TRENDYOL / INSTAGRAM / WHATSAPP */
  MIKRO_PROJE_KODU: z.string().default('SHOPIFY'),
  /** Cari kodu prefix — Yunus: "120.20.01.E" sabit */
  MIKRO_CARI_PREFIX: z.string().default('120.20.01.E'),
  /** Cari sayacının başlangıcı (Yunus son cari: E3801, seed 10000 onaylı) */
  MIKRO_CARI_SEED: z.coerce.number().default(10000),
  /** Stok kodu prefix — Yunus: ara depoya sevkiyat için "VIA" eklenir
   *  (ör. bizim SKU '100' → Mikro stok kodu 'VIA100') */
  MIKRO_STOK_PREFIX: z.string().default('VIA'),
  /** Otomatik Mikro push aktif mi? (false → sadece DB'ye yazılır, manuel push gerek) */
  MIKRO_AUTO_PUSH: z.coerce.boolean().default(true),
  /** true → Mikro push SİPARİŞ ANINDA (eski davranış, takip no'suz).
   *  false (default) → push KARGO ETİKETİ SONRASI, takip no ile
   *  (Yunus akışı: el terminali sipariş kağıdını kargo etiketiyle birlikte bassın). */
  MIKRO_PUSH_ON_ORDER: z.coerce.boolean().default(false),
  /** Sipariş düşünce KargoLab etiketi OTOMATİK oluşsun mu? (müşterinin checkout'ta
   *  seçtiği kurye + kapıda ödeme ile; havale-pending paid olana dek bekler).
   *  false → sadece tedarikçi panelindeki manuel buton. */
  KARGOLAB_AUTO_LABEL: z.coerce.boolean().default(true),
  /** Default depo no */
  MIKRO_DEPO_NO: z.coerce.number().default(1),
  /** ARADEPO sabit carisi — Yunus'un günlük Woo→Mikro akışındaki cari (müşteri carisi AÇILMAZ) */
  MIKRO_ARADEPO_CARI: z.string().default('120.02.01.V004'),
  /** ANA FİRMA (fatura) DB API'si — port 7782; boş bırakılırsa firma push atlanır */
  MIKRO_FIRMA_API_URL: z.string().default('http://85.111.96.204:7782/api'),
  /** Ana firma DB'ye de sipariş push edilsin mi (fatura kesimi için, müşteri carili) */
  MIKRO_FIRMA_PUSH: z.coerce.boolean().default(true),
  /** Ana firma DB depo no (Yunus örneği: 1) */
  MIKRO_FIRMA_DEPO: z.coerce.number().default(1),
  /** Via müşteri numarası — aradepo evrak seri öneki (Yunus kuralı: '001S25976') */
  MIKRO_MUSTERI_NO: z.string().default('001'),
  /** Pazaryeri belirteci — S=Shopify, T=Trendyol... (seri: aradepo '001S…', firma 'S…') */
  MIKRO_PAZARYERI: z.string().default('S'),
  /** ARADEPO depo no (ViaDolapdere) */
  MIKRO_ARADEPO_DEPO: z.coerce.number().default(60),
  /** Evrak sıra — Yunus'un Woo akışındaki sabit (kanal kodu gibi) */
  MIKRO_EVRAK_SIRA: z.coerce.number().default(4000),
  /** SRM merkez kodu */
  MIKRO_SRM_MERKEZ: z.string().default('99'),
  /** Ödeme planı no */
  MIKRO_ODEME_PLANI_NO: z.coerce.number().default(99),

  // Storage
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  // AI (shipment extraction etc.)
  /** Anthropic API key for Claude — used by AI shipment extractor */
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Default Claude model for cheap extraction tasks */
  ANTHROPIC_MODEL_FAST: z.string().default('claude-haiku-4-5'),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // App
  APP_NAME: z.string().default('Via Mood Vendor Platform'),
  APP_URL: z.string().url().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
export type Env = typeof env;
