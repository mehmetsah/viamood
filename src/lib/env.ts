import { z } from 'zod';

/**
 * Zod-validated environment variables.
 * Hata veriyorsa boot'ta erken patlar (silent prod sürprizi yok).
 */
/**
 * Ortam bayrağı: YALNIZ 'true' / '1' açar; 'false', '0', boş ve tanınmayan her şey kapatır.
 *
 * NEDEN VAR: `z.coerce.boolean()` içeride `Boolean(v)` çağırır — `Boolean('false') === true`.
 * Yani `MIKRO_AUTO_PUSH=false` yazmak bayrağı KAPATMIYOR, açık bırakıyordu; varsayılanı
 * `true` olan kill switch'ler env'den kapatılamıyordu (15 Eyl 2026 ölçümü:
 * 'false' → true, '0' → true). Dosyada üç yerde "z.coerce.boolean KULLANMA" uyarısı
 * vardı ama dört bayrak hâlâ onu kullanıyordu.
 *
 * Davranış korunur: değişken TANIMSIZ ise `varsayilan` neyse o geçerli kalır.
 */
const bayrak = (varsayilan: boolean) =>
  z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default(varsayilan ? 'true' : 'false');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Auth
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 chars'),
  /**
   * Auth.js taban adresi. OPSİYONEL — bilinçli olarak varsayılansız.
   *
   * Auth.js v5'te AÇIKÇA verilmiş AUTH_URL, `trustHost` ayarını EZER: host
   * başlıklardan türetilmez, bu değer kullanılır. Prod'da bu değer yanlıştı
   * (`https://localhost:4001`) ve /api/auth/providers onu gösteriyordu →
   * OAuth callback'i localhost'a kaçıyordu. Sunucuya SSH kapalı olduğu için
   * .env düzeltilemiyor; aşağıdaki temizleme bu yüzden var (bkz. temizleAuthUrl).
   */
  AUTH_URL: z.string().url().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_APPLE_ID: z.string().optional(),
  AUTH_APPLE_SECRET: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),

  // ── SMTP (Resend yoksa yedek gönderim yolu) ──────────────────────────────
  // 12 Ağu'dan beri "Şifremi Unuttum" tek bir sebeple blokedeydi: prod'da mail
  // anahtarı yoktu. Resend hesabı beklenirken Gmail SMTP uygulama şifresiyle
  // açıldı. Dördü de OPSİYONEL — yoksa gönderici stub'a düşer (ve artık
  // {ok:false} döner, bkz. lib/email/sender.ts).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
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
  // Internal/cron endpoint anahtarı — SHOPIFY_CLIENT_SECRET'tan AYRI tutulur (sızan Shopify
  // secret'ıyla tehlikeli internal endpoint'ler çağrılamasın; decouple 2026-08-01).
  INTERNAL_API_KEY: z.string().optional(),
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

  // HALKÖDE (Halkbank) Sanal POS — üçüncü kart gateway'i (3D Secure)
  // BASE_URL test: https://testapp.halkode.com.tr/ccpayment
  //          canlı: https://app.halkode.com.tr/ccpayment  (anahtarlar Halköde onayından SONRA gelir)
  //
  // ⚠️ staging.halkode.com.tr KULLANMA. Dokümantasyonda test adresi olarak o yazıyor ve
  // istekleri kabul ediyor (token veriyor, 3D formu üretiyor) ama üye işyeri POS tanımı
  // orada YOK → finansal bacak banka hatası V004 ile düşüyor. Halköde 8 Eyl 2026'da
  // doğru test adresinin testapp.halkode.com.tr olduğunu bildirdi.
  HALKODE_BASE_URL: z.string().url().default('https://testapp.halkode.com.tr/ccpayment'),
  HALKODE_APP_ID: z.string().optional(),
  HALKODE_APP_SECRET: z.string().optional(),
  HALKODE_MERCHANT_KEY: z.string().optional(),
  /** Gateway açık mı? Kimlik bilgileri dolu olsa bile bu 'true' olmadan ödeme başlatılmaz.
   *  DİKKAT: z.coerce.boolean() KULLANMA — Boolean('false')===true (kill switch bozulur). */
  HALKODE_ENABLED: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),

  // KargoLab
  KARGOLAB_API_URL: z.string().url().default('https://kargolab.com/api/v1'),
  KARGOLAB_HOST_HEADER: z.string().default('kargolab.com'),
  KARGOLAB_USER_EMAIL: z.string().email().optional(),
  KARGOLAB_USER_PASSWORD: z.string().optional(),
  KARGOLAB_MEMBER_ID: z.coerce.number().optional(),
  KARGOLAB_API_KEY: z.string().optional(), // legacy

  // Via Mood BAYİ TENANT'ı (kargo.viamood.com.tr) — tedarikçiler burada ayrı üye
  // olarak açılır. Yukarıdaki KARGOLAB_* ayarları ANA tenant içindir (Via Mood'un
  // kendi müşteri hesabı, üye 7000070); ikisi karıştırılmamalı.
  KARGOLAB_TENANT_HOST: z.string().optional(),
  KARGOLAB_TENANT_ADMIN_EMAIL: z.string().email().optional(),
  KARGOLAB_TENANT_ADMIN_PASSWORD: z.string().optional(),

  // Trendyol Product Integration API (FAZ 2 katalog çekimi — çoklu tedarikçi)
  // Test kaynağı: KargoLab member_id=30 mağazasının Trendyol entegrasyon bilgileri
  // (integration_api_keys: api_key / secret_key / supplier_id). Prod'da her tedarikçi
  // (Halil İbrahim vb.) kendi supplier bilgisiyle bağlanır. İstemci creds'i parametre
  // alır; bu env yalnızca tek-tedarikçi script/test kolaylığı içindir.
  TRENDYOL_SUPPLIER_ID: z.string().optional(),
  TRENDYOL_API_KEY: z.string().optional(),
  TRENDYOL_SECRET_KEY: z.string().optional(),

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
  /** Kargo tutarını Mikro evrağına satır olarak yansıtmak için stok/hizmet kodu.
   *  BOŞ (default) → kargo satırı EKLENMEZ (mevcut davranış; evraka sadece ürünler girer).
   *  Yunus'un Woo→Mikro akışındaki kargo kalemi kodu (ör. 'KARGO' / 'VIAKARGO') girilince
   *  orders.shippingCents bir satır olarak evraka eklenir (KDV-dahil→ayrıştırılmış). */
  MIKRO_KARGO_STOK: z.string().default(''),
  /** Kargo satırının Mikro cinsi: 0=Stok (default, ürünlerle aynı), 1=Hizmet. */
  MIKRO_KARGO_CINSI: z.coerce.number().default(0),
  /** Kargo KDV oranı (%). Kargo TR'de %20; muafiyet için 0. */
  MIKRO_KARGO_KDV: z.coerce.number().default(20),
  /** Otomatik Mikro push aktif mi? (false → sadece DB'ye yazılır, manuel push gerek) */
  MIKRO_AUTO_PUSH: bayrak(true),
  /** true → Mikro push SİPARİŞ ANINDA (eski davranış, takip no'suz).
   *  false (default) → push KARGO ETİKETİ SONRASI, takip no ile
   *  (Yunus akışı: el terminali sipariş kağıdını kargo etiketiyle birlikte bassın). */
  MIKRO_PUSH_ON_ORDER: bayrak(false),
  /** Sipariş düşünce KargoLab etiketi OTOMATİK oluşsun mu? (müşterinin checkout'ta
   *  seçtiği kurye + kapıda ödeme ile; havale-pending paid olana dek bekler).
   *  false → sadece tedarikçi panelindeki manuel buton. */
  KARGOLAB_AUTO_LABEL: bayrak(true),

  /** KargoLab durum webhook'u imza secret'ı. KargoLab bu secret'ı `?key=` veya
   *  `x-kargolab-secret` header'ında gönderir → /api/kargolab/webhook doğrular.
   *  Boşsa webhook 401 döner (kapalı). */
  KARGOLAB_WEBHOOK_SECRET: z.string().optional(),

  /** Kapıda ödeme (COD) ile YENİ SİPARİŞ alınabilir mi? KAPALI (Mehmet kararı, 10 Ağu 2026).
   *  Tema checkout'unda seçenek zaten gizli; bu sunucu kapısı doğrudan POST'u da reddeder.
   *  Mevcut açık COD siparişlerini ETKİLEMEZ — sadece yeni sipariş oluşturmayı engeller.
   *  Açmak için: sunucu env'ine COD_ENABLED=true + Theme Editor'da "Kapıda Ödeme açık".
   *  DİKKAT: z.coerce.boolean() KULLANMA — Boolean('false')===true (kill switch bozulur). */
  COD_ENABLED: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),

  /** COD (kapıda ödeme) sipariş kargo TESLİM edilince Shopify'da otomatik "ödendi" (paid)
   *  yapılsın mı? MASTER SWITCH / KILL SWITCH.
   *  DİKKAT: z.coerce.boolean() KULLANMA — Boolean('false')===true olduğu için "false" ile
   *  kapatılamaz (kill switch bozulur). Sadece 'true'/'1' açar; başka her şey (false/0/boş) kapalı. */
  COD_AUTO_PAID_ON_DELIVERY: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),
  /** true iken: koşulları kontrol eder + loglar ama Shopify'a POST YAPMAZ (dry-run).
   *  Canlı yayın için 'false' yaz (o zaman gerçek POST). Aynı 'true'/'1' → dry-run mantığı. */
  COD_AUTO_PAID_DRY_RUN: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('true'),
  /** Default depo no */
  MIKRO_DEPO_NO: z.coerce.number().default(1),
  /** ARADEPO sabit carisi — Yunus'un günlük Woo→Mikro akışındaki cari (müşteri carisi AÇILMAZ) */
  MIKRO_ARADEPO_CARI: z.string().default('120.02.01.V004'),
  /** ANA FİRMA (fatura) DB API'si — port 7782; boş bırakılırsa firma push atlanır */
  MIKRO_FIRMA_API_URL: z.string().default('http://85.111.96.204:7782/api'),
  /** Ana firma DB'ye de sipariş push edilsin mi (fatura kesimi için, müşteri carili) */
  MIKRO_FIRMA_PUSH: bayrak(true),
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

/**
 * AUTH_URL "localhost" içeriyorsa process.env'den SİLER.
 *
 * NEDEN: Auth.js v5 bu değişkeni doğrudan `process.env`'den okur — bizim zod
 * nesnemizden değil. Değişken tanımlı kaldığı sürece `trustHost: true` etkisiz
 * kalır. Prod'da yanlış bir localhost adresi ayarlı; onu burada düşürüyoruz ki
 * host gerçek istekten (X-Forwarded-Host) türetilsin.
 *
 * GERÇEK bir AUTH_URL ayarlıysa (localhost içermiyorsa) DOKUNULMAZ — bilinçli
 * kurulumlar bozulmaz.
 */
/** İki değişken de aynı işi görür; next-auth `AUTH_URL ?? NEXTAUTH_URL` sırasıyla okur. */
const AUTH_URL_ADLARI = ['AUTH_URL', 'NEXTAUTH_URL'] as const;

export function temizleAuthUrl(): string[] {
  const yerelMi = (v: string) => /localhost|127\.0\.0\.1/i.test(v);
  const dusurulen: string[] = [];

  // Her iki ad BAĞIMSIZ değerlendirilir. Önceki sürüm `AUTH_URL` boşsa hemen
  // dönüyordu ve eski adı hiç temizlemiyordu; prod'da yalnız NEXTAUTH_URL
  // tanımlı olduğu için düzeltme orada ETKİSİZ kalmıştı (15 Eyl 2026 ölçümü:
  // /api/auth/providers → "https://localhost:4001", uyarı log'u hiç basılmadı).
  for (const ad of AUTH_URL_ADLARI) {
    const ham = (process.env[ad] ?? '').trim();
    if (!ham || !yerelMi(ham)) continue;
    delete process.env[ad];
    dusurulen.push(`${ad}="${ham}"`);
  }
  return dusurulen;
}

/**
 * Modül yüklenirken düşürülen değişkenler (teşhis + test içindir).
 * Boş dizi = düşürülecek bir şey yoktu.
 */
export const dusurulenAuthUrl = temizleAuthUrl();
if (dusurulenAuthUrl.length > 0) {
  console.warn(
    `[env] ${dusurulenAuthUrl.join(', ')} localhost adresi — düşürüldü. ` +
      'Host artık gelen istekten türetilecek (trustHost).',
  );
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
export type Env = typeof env;
