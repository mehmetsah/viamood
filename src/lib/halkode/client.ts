/**
 * HALKÖDE (Halkbank) Sanal POS istemcisi — 3D Secure kart gateway'i.
 *
 * İyzico/PayTR'ye PARALEL üçüncü kart gateway'i. Akış (docs.halkode.com.tr):
 *   1) POST /api/token          → app_id + app_secret → JWT (sonraki tüm çağrılar Bearer)
 *   2) POST /api/paySmart3D     → kart + hash_key → bankaya auto-submit eden HTML form döner
 *   3) tarayıcı 3D/OTP → return_url'e (başarı) veya cancel_url'e (hata) GET/POST ile döner
 *   4) dönüşteki hash_key ÇÖZÜLÜP doğrulanır (tutar/invoice kurcalanmamış mı)
 *   5) POST /api/checkstatus    → sunucu-sunucu kesin doğrulama (tek güven kaynağı)
 *   6) POST /api/refund         → iade/iptal (aynı uç; tutar tam ise iptal, kısmi ise iade)
 *
 * ⚠️ HASH — PHP referans kodunun BİREBİR karşılığı (docs "hashGenerator"):
 *     data  = total|installments_number|currency_code|merchant_key|invoice_id
 *     iv    = sha1(rastgele)[0..16)          → 16 KARAKTERLİK ASCII STRING (byte değil)
 *     pass  = sha1(app_secret)
 *     salt  = sha1(rastgele)[0..4)
 *     key   = sha256(pass + salt)            → 64 KARAKTERLİK HEX STRING
 *     enc   = AES-256-CBC(data, key, iv) → base64
 *     bundle= iv:salt:enc  ve  '/' → '__'
 *
 *   PHP'nin openssl_encrypt'i key/iv'yi HAM STRING olarak alır: 64 karakterlik hex
 *   string'in İLK 32 BYTE'ını anahtar yapar (hex decode ETMEZ). Node'da birebir eşlemek
 *   için Buffer.from(hex,'utf8').subarray(0,32) kullanılır — 'hex' encoding KULLANMA,
 *   yoksa hash tutmaz ve Halköde 68 (hash uyuşmazlığı) döner.
 */
import crypto from 'node:crypto';

/**
 * Not: bu modül bilerek `src/lib/env.ts`'i İTHAL ETMEZ, process.env'i doğrudan okur.
 * Sebep: gateway'i Next boot'undan bağımsız, tek başına koşturulabilir tutmak
 * (`scripts/halkode-test.ts` staging'e böyle bağlanıyor; env.ts DATABASE_URL/REDIS_URL
 * ister ve tüm uygulamayı ayağa kaldırır). HALKODE_* değişkenleri env.ts şemasında
 * ayrıca TANIMLI — uygulama boot'unda doğrulama/dokümantasyon oradan gelir.
 */

/** Halköde uygulama durum kodları (docs/durum-kodlari). 100 = başarı. */
export const HALKODE_STATUS = {
  SUCCESS: 100,
  INVALID_CREDENTIALS: 30,
  TRANSACTION_NOT_FOUND: 31,
  INVALID_INVOICE: 32,
  ORDER_OR_PAYMENT_FAILED: 41,
  REFUND_FAILED: 49,
  HASH_MISMATCH: 68,
} as const;

export interface HalkodeItem {
  name: string;
  price: number; // TL — items toplamı `total` ile EŞİT olmalı (yoksa status 13)
  quantity: number;
  description?: string;
}

export interface Halkode3DParams {
  ccHolderName: string;
  ccNo: string;
  expiryMonth: string; // "08"
  expiryYear: string; // "2028"
  cvv: string;
  total: number; // TL
  installmentsNumber: number; // 1 = tek çekim
  invoiceId: string; // bizim benzersiz sipariş no
  invoiceDescription?: string;
  name: string;
  surname: string;
  items: HalkodeItem[];
  returnUrl: string;
  cancelUrl: string;
  currencyCode?: string; // default TRY
  transactionType?: 'Auth' | 'PreAuth';
}

/** Dönüş hash'i çözülünce elde edilen alanlar. */
export interface HalkodeHashParts {
  status: string;
  total: string;
  invoiceId: string;
  orderId: string;
  currencyCode: string;
  raw: string[]; // ham parçalar (spec dışı sıra çıkarsa teşhis için)
}

/** Test/canlı taban adresleri — İKİSİ DE tek yerde tanımlı. */
const BASE_TEST = 'https://testapp.halkode.com.tr/ccpayment';
const BASE_LIVE = 'https://app.halkode.com.tr/ccpayment';

interface HalkodeCfg {
  baseUrl: string;
  appId: string;
  appSecret: string;
  merchantKey: string;
  enabled: boolean;
}

/**
 * Admin ayarlarını (DB) okur. İyzico/PayTR ile AYNI kalıp: kimlikler önce ayarlardan,
 * yoksa env'den.
 *
 * ⚠️ `import()` DİNAMİK ve try/catch içinde: `scripts/halkode-*.ts` bu modülü Node'un
 * yerel TS desteğiyle, Next/webpack olmadan çalıştırıyor; orada `@/db/client` alias'ı
 * çözülmez. İçe aktarma başarısız olursa sessizce env'e düşülür — betikler .env.local
 * ile çalışmaya devam eder, sunucuda ise ayarlar okunur.
 */
async function paymentSettings(): Promise<Partial<import('@/db/schema').PaymentSettings>> {
  try {
    const m = await import('../settings/store');
    return (await m.getStoreSettings()).payment ?? {};
  } catch {
    return {};
  }
}

/**
 * Gizli önizleme çerezi hangi ortamı açıyor? (bkz. lib/halkode/preview.ts)
 *
 * `next/headers` yalnız istek bağlamında çalışır; betikler/cron bu modülü hiç
 * yükleyemeyebilir. Bu yüzden DİNAMİK import + try/catch — paymentSettings() ile aynı kalıp.
 */
async function previewOrtami(): Promise<'test' | 'canli' | null> {
  try {
    const m = await import('./preview');
    return await m.halkodeOnizlemeOrtami();
  } catch {
    return null;
  }
}

interface Kimlik {
  appId: string;
  appSecret: string;
  merchantKey: string;
}

const kimlikDolu = (k: Kimlik) => !!(k.appId && k.appSecret && k.merchantKey);

/**
 * Ortam nasıl belirlenir?
 *
 * 🔴 17 Eyl 2026 arızasının kök sebebi: ortam YALNIZ önizleme çerezinden
 * okunuyordu. Banka 3D dönüşü BAŞKA origin'den (app.halkode.com.tr → bizim uç)
 * geldiği için çerez taşınmaz; `onizleme` null olur, baseUrl test adresine
 * düşer, `canliMi=false` olur ve TEST kimlik yuvası seçilir. Prod'da test yuvası
 * BOŞ olduğu için `halkodeConfigured()` false döner ve callback ödemeyi
 * "sebep=yapilandirma" diyerek reddeder — para çekilmiş, sipariş açılmamış olur.
 *
 * Çözüm: ortam artık ÇAĞIRANDAN gelir. Banka dönüşünü işleyen uçlar ortamı
 * istekten bilir (gerçek ödeme ucu daima canlı; deneme ucu adresteki anahtardan
 * — `anahtardanOrtam()`), çereze hiç bakmaz. Çerez yalnız SAYFA gösteriminde,
 * yani `ortamZorla` verilmediği yolda, eskisi gibi çalışmaya devam eder.
 */
export type HalkodeOrtamSecimi = 'test' | 'canli' | null | undefined;

async function cfg(ortamZorla?: HalkodeOrtamSecimi): Promise<HalkodeCfg> {
  const ps = await paymentSettings();
  // Ortam açıkça verildiyse çerez HİÇ OKUNMAZ — istek bağlamı olmayabilir bile.
  const onizleme = ortamZorla ?? (await previewOrtami());

  // CANLI önizleme YALNIZ paneldeki "canlı deneme sayfası" anahtarı açıkken geçerli.
  // Bu, gerçek para çeken tek yolun tek tıkla kapatılabilen kill switch'i: deneme
  // bitince panelden kapatılır, elde kalan link o an ölür (deploy gerekmez).
  // Anahtar kapalıysa çerez HİÇ YOKMUŞ gibi davranırız — sessizce test ortamına
  // düşmeyiz, çünkü o da yanlış olurdu (kullanıcı canlı sandığı yerde test görürdü).
  //
  // ⚠️ ÖNEMLİ AYRIM: çerezle gelen önizleme kill switch'i AÇAR (aşağıdaki
  // `enabled`), ama ÇAĞIRANIN zorladığı ortam AÇMAZ. Yoksa `cfg('canli')`
  // demek kill switch'i baypas etmek olurdu; gerçek müşteri ödemesi
  // `halkode_enabled` ile yönetilir, deneme anahtarıyla değil.
  const cerezCanli = onizleme === 'canli' && ps.halkode_canli_deneme === true;
  const cerezTest = onizleme === 'test' && !ortamZorla;

  // Adres/kimlik seçimi için ortam: zorlanan ortam da sayılır.
  const canliOnizleme = ortamZorla === 'canli' || cerezCanli;
  const testOnizleme = ortamZorla === 'test' || cerezTest;

  // Taban adres önceliği:
  //  1) önizleme çerezi ne diyorsa O (test → testapp, canlı → app) — env override'ı
  //     bile bu yolda geçersizdir; önizleme hangi ortamda olduğunu kesin bilmeli.
  //  2) HALKODE_BASE_URL açıkça verilmişse o (operasyonel override / betikler)
  //  3) yoksa admin'deki "Test modu" seçimi: 1 → testapp, 0 → app
  //
  // Yedek değer TESTAPP olmalı: staging.halkode.com.tr istekleri kabul eder (token verir,
  // 3D formu üretir) ama üye işyeri POS tanımı orada YOK → banka V004 ile düşer. Doğru
  // test adresi testapp.halkode.com.tr (bkz. src/lib/env.ts). Bu dosya process.env'i
  // DOĞRUDAN okuduğu için env.ts'deki zod default'u buraya uygulanmaz — yedek burada da
  // doğru olmalı, yoksa HALKODE_BASE_URL tanımsızken sessizce staging'e düşeriz.
  const baseUrl = canliOnizleme
    ? BASE_LIVE
    : testOnizleme
      ? BASE_TEST
      : (process.env.HALKODE_BASE_URL || ((ps.halkode_test_mode ?? 1) === 0 ? BASE_LIVE : BASE_TEST)).replace(/\/+$/, '');

  const canliMi = /(^|\/\/)app\.halkode\./i.test(baseUrl);

  // ⚠️ CANLI ve TEST kimlikleri AYRI YUVALARDA durur — biri diğerini EZMEZ.
  // Tek yuva olsaydı canlı anahtarları girmek test sayfasını sessizce bozardı:
  // test sayfası testapp'e gider ama elinde canlı kimlik olurdu → status 30.
  // İki sayfa yan yana yaşayabilsin diye ayrıldı.
  const canliKimlik: Kimlik = {
    appId: ps.halkode_live_app_id || process.env.HALKODE_LIVE_APP_ID || '',
    appSecret: ps.halkode_live_app_secret || process.env.HALKODE_LIVE_APP_SECRET || '',
    merchantKey: ps.halkode_live_merchant_key || process.env.HALKODE_LIVE_MERCHANT_KEY || '',
  };
  const testKimlik: Kimlik = {
    appId: ps.halkode_app_id || process.env.HALKODE_APP_ID || '',
    appSecret: ps.halkode_app_secret || process.env.HALKODE_APP_SECRET || '',
    merchantKey: ps.halkode_merchant_key || process.env.HALKODE_MERCHANT_KEY || '',
  };

  // Geri uyum: canlı yuvalar boşken canlı ortamda eski tek-yuva davranışı sürer.
  // `scripts/halkode-*.ts` HALKODE_BASE_URL + HALKODE_APP_ID ile canlıya bağlanıyor;
  // bu dal olmasaydı betikler bir anda kimliksiz kalırdı.
  const k = canliMi && kimlikDolu(canliKimlik) ? canliKimlik : testKimlik;

  // ⚠️ MERCHANT KEY ŞEKİL DENETİMİ — sessiz bozulmayı yüksek sesle söyler.
  // Üye işyeri anahtarı bcrypt biçimindedir ($2y$10$…) ve içindeki '$'
  // karakterleri onu .env dosyalarında TEHLİKELİ yapar: hem bash `source` hem
  // Next'in dotenv-expand'i `$2y`/`$10`'u değişken sanıp genişletir ve 60
  // karakterlik anahtar sessizce 22 karaktere düşer. Halköde buna
  // "status 14 · merchant not found" der — yani hata mesajı sizi anahtarın
  // YANLIŞ olduğuna değil, üye işyerinin YOK olduğuna inandırır (17 Eyl 2026'da
  // tam olarak bu yaşandı, teşhis yarım saat aldı).
  //
  // Bu yüzden canlı anahtarlar .env'de DEĞİL, admin ayarlarında (DB) durur.
  // Yine de biri env'e koyarsa log'da tek satırlık uyarı görünsün — DEĞER YOK.
  if (k.merchantKey && !k.merchantKey.startsWith('$2y$')) {
    console.warn(
      `[halkode] merchant_key beklenen bcrypt biçiminde değil (uzunluk ${k.merchantKey.length}). ` +
        `.env içinde tırnaksız duruyorsa '$' genişletmesiyle bozulmuş olabilir; ` +
        `doğru yer admin → Ayarlar → Halköde CANLI alanlarıdır.`,
    );
  }

  return {
    baseUrl,
    ...k,
    // Önizleme kill switch'i AÇAR — yalnız çerezi olan kişi için, yalnız o ortamda.
    enabled:
      cerezCanli ||
      cerezTest ||
      ps.halkode_enabled === true ||
      process.env.HALKODE_ENABLED === 'true' ||
      process.env.HALKODE_ENABLED === '1',
  };
}

/**
 * GERÇEK müşteri ödemesinin ortamı — çerezden BAĞIMSIZ.
 *
 * `/initialize` ve `/callback` bunu kullanır; ikisi de aynı cevabı almak
 * ZORUNDA, yoksa ödeme bir ortamda başlatılıp diğerinde doğrulanır (17 Eyl
 * arızası tam olarak buydu: başlatma canlıda, doğrulama testte).
 *
 * Sıra:
 *   1) `halkode_test_mode` AÇIKÇA verilmişse ona uy (0 → canlı, 1 → test).
 *      Operatörün test niyeti sessizce ezilmemeli.
 *   2) Verilmemişse DOLU kimlik yuvası karar verir. Prod'da yalnız canlı yuva
 *      dolu olduğu için doğru cevap 'canli' olur — eskiden burada `?? 1`
 *      yüzünden test'e düşülüyor, test yuvası boş olduğundan
 *      `halkodeConfigured()` false dönüyordu.
 *   3) İkisi de boşsa null → çağıran "yapılandırma eksik" diyebilir.
 */
export async function odemeOrtami(): Promise<'test' | 'canli' | null> {
  const ps = await paymentSettings();
  if (ps.halkode_test_mode === 0) return 'canli';
  if (ps.halkode_test_mode === 1) return 'test';

  const canliDolu = kimlikDolu({
    appId: ps.halkode_live_app_id || process.env.HALKODE_LIVE_APP_ID || '',
    appSecret: ps.halkode_live_app_secret || process.env.HALKODE_LIVE_APP_SECRET || '',
    merchantKey: ps.halkode_live_merchant_key || process.env.HALKODE_LIVE_MERCHANT_KEY || '',
  });
  if (canliDolu) return 'canli';

  const testDolu = kimlikDolu({
    appId: ps.halkode_app_id || process.env.HALKODE_APP_ID || '',
    appSecret: ps.halkode_app_secret || process.env.HALKODE_APP_SECRET || '',
    merchantKey: ps.halkode_merchant_key || process.env.HALKODE_MERCHANT_KEY || '',
  });
  return testDolu ? 'test' : null;
}

/** Kill switch — kimlik bilgileri dolu olsa bile bu açık değilse ödeme başlatılmaz. */
export async function halkodeEnabled(ortam?: HalkodeOrtamSecimi): Promise<boolean> {
  return (await cfg(ortam)).enabled;
}

export async function halkodeConfigured(ortam?: HalkodeOrtamSecimi): Promise<boolean> {
  const c = await cfg(ortam);
  return !!(c.baseUrl && c.appId && c.appSecret && c.merchantKey);
}

/** Halköde CANLI ortamda mı? (app.halkode.com.tr = canlı, testapp.halkode.com.tr = test) */
export async function halkodeIsLive(ortam?: HalkodeOrtamSecimi): Promise<boolean> {
  return /(^|\/\/)app\.halkode\./i.test((await cfg(ortam)).baseUrl);
}

/** Dönüş imzasını çözmek için gereken app_secret (ayar → env). */
export async function halkodeAppSecret(ortam?: HalkodeOrtamSecimi): Promise<string> {
  return (await cfg(ortam)).appSecret;
}

// ── Hash ────────────────────────────────────────────────────────────────────

/** PHP openssl_encrypt/decrypt semantiği: key = hex string'in ilk 32 byte'ı. */
function aesKey(password: string, salt: string): Buffer {
  const hex = crypto.createHash('sha256').update(password + salt, 'utf8').digest('hex');
  return Buffer.from(hex, 'utf8').subarray(0, 32);
}

/**
 * Ham `iv:salt:enc` paketi üretir. Hem istek hash'i hem (testte) dönüş hash'i
 * bu SAME şifrelemeyi kullanır — fark yalnız `data`'nın alan sırasıdır.
 */
export function encryptBundle(data: string, appSecret: string, seed?: { iv: string; salt: string }): string {
  const iv = seed?.iv ?? crypto.createHash('sha1').update(crypto.randomBytes(16)).digest('hex').slice(0, 16);
  const salt = seed?.salt ?? crypto.createHash('sha1').update(crypto.randomBytes(16)).digest('hex').slice(0, 4);
  const password = crypto.createHash('sha1').update(appSecret, 'utf8').digest('hex');

  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey(password, salt), Buffer.from(iv, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]).toString('base64');

  return `${iv}:${salt}:${encrypted}`.replace(/\//g, '__');
}

/** İstek hash_key'i (paySmart3D / refund öncesi). */
export function generateHashKey(
  params: { total: number | string; installmentsNumber: number; currencyCode: string; merchantKey: string; invoiceId: string },
  appSecret: string,
  seed?: { iv: string; salt: string },
): string {
  const data = [params.total, params.installmentsNumber, params.currencyCode, params.merchantKey, params.invoiceId].join('|');
  return encryptBundle(data, appSecret, seed);
}

/**
 * Dönüş hash_key'ini ÇÖZER (3D dönüşü / complete yanıtı).
 * Çözülemezse null → çağıran tarafı işlemi REDDETMELİ.
 */
export function decodeHashKey(hashKey: string, appSecret: string): HalkodeHashParts | null {
  if (!hashKey || !appSecret) return null;
  try {
    const bundle = hashKey.replace(/__/g, '/');
    const parts = bundle.split(':');
    if (parts.length < 3) return null;
    const iv = parts[0] ?? '';
    const salt = parts[1] ?? '';
    const encrypted = parts.slice(2).join(':');
    if (!iv || !salt || !encrypted) return null;
    const password = crypto.createHash('sha1').update(appSecret, 'utf8').digest('hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey(password, salt), Buffer.from(iv, 'utf8'));
    const decrypted = Buffer.concat([decipher.update(encrypted, 'base64'), decipher.final()]).toString('utf8');

    const a = decrypted.split('|');
    return {
      status: a[0] ?? '',
      total: a[1] ?? '',
      invoiceId: a[2] ?? '',
      orderId: a[3] ?? '',
      currencyCode: a[4] ?? '',
      raw: a,
    };
  } catch {
    return null; // yanlış secret / kurcalanmış hash → çözülemez
  }
}

/**
 * 3D dönüşünü doğrular: hash çözülüyor MU ve içindeki invoice/total BİZİM
 * beklediğimizle aynı MI. Tutar karşılaştırması kuruş bazında yapılır
 * ("1.00" ile "1.0" ve "1" aynı sayılır).
 */
export function verifyReturnHash(
  hashKey: string,
  expected: { invoiceId: string; total: number },
  appSecret: string,
): { ok: boolean; reason?: string; parts?: HalkodeHashParts } {
  const parts = decodeHashKey(hashKey, appSecret);
  if (!parts) return { ok: false, reason: 'hash çözülemedi (imza geçersiz)' };
  if (parts.invoiceId !== expected.invoiceId) {
    return { ok: false, reason: 'invoice_id uyuşmuyor', parts };
  }
  const got = Math.round(parseFloat(parts.total) * 100);
  const want = Math.round(expected.total * 100);
  if (!Number.isFinite(got) || got !== want) return { ok: false, reason: 'tutar uyuşmuyor', parts };
  return { ok: true, parts };
}

// ── HTTP ────────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

async function postJson(
  path: string,
  body: Json,
  token?: string,
  ortam?: HalkodeOrtamSecimi,
): Promise<{ httpStatus: number; json: Json }> {
  const resp = await fetch(`${(await cfg(ortam)).baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let json: Json = {};
  try {
    json = JSON.parse(text) as Json;
  } catch {
    json = { status_code: -1, status_description: text.slice(0, 500) };
  }
  return { httpStatus: resp.status, json };
}

/** Token servisi. Token kısa ömürlü; çağrı başına alınır (cache yok — basit ve güvenli). */
export async function getToken(
  ortam?: HalkodeOrtamSecimi,
): Promise<{ ok: true; token: string; is3d: number } | { ok: false; error: string }> {
  const c = await cfg(ortam);
  if (!c.appId || !c.appSecret) return { ok: false, error: 'HALKODE kimlik bilgileri eksik' };
  try {
    const { json } = await postJson('/api/token', { app_id: c.appId, app_secret: c.appSecret }, undefined, ortam);
    const data = (json.data ?? {}) as Json;
    if (json.status_code === HALKODE_STATUS.SUCCESS && typeof data.token === 'string') {
      return { ok: true, token: data.token, is3d: Number(data.is_3d ?? 0) };
    }
    return { ok: false, error: `token alınamadı (${json.status_code}: ${String(json.status_description ?? '')})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 3D ödeme başlat. Halköde başarıda BANKAYA auto-submit eden HTML döner
 * (JSON değil) — bu HTML tarayıcıya olduğu gibi basılır.
 * Hata durumunda JSON döner (status_code != 100).
 */
export async function paySmart3D(
  p: Halkode3DParams,
  token: string,
  ortam?: HalkodeOrtamSecimi,
): Promise<{ ok: true; html: string } | { ok: false; statusCode: number; error: string; raw?: Json }> {
  const c = await cfg(ortam);
  const currency = p.currencyCode ?? 'TRY';
  const total = p.total.toFixed(2);

  const hashKey = generateHashKey(
    {
      total,
      installmentsNumber: p.installmentsNumber,
      currencyCode: currency,
      merchantKey: c.merchantKey,
      invoiceId: p.invoiceId,
    },
    c.appSecret,
  );

  const body: Json = {
    cc_holder_name: p.ccHolderName,
    cc_no: p.ccNo,
    expiry_month: p.expiryMonth,
    expiry_year: p.expiryYear,
    cvv: p.cvv,
    currency_code: currency,
    installments_number: p.installmentsNumber,
    invoice_id: p.invoiceId,
    invoice_description: p.invoiceDescription ?? `Via Mood #${p.invoiceId}`,
    total: Number(total),
    items: p.items.map((i) => ({
      name: i.name.slice(0, 100),
      price: i.price,
      quantity: i.quantity,
      description: i.description ?? i.name.slice(0, 100),
    })),
    name: p.name,
    surname: p.surname,
    merchant_key: c.merchantKey,
    hash_key: hashKey,
    return_url: p.returnUrl,
    cancel_url: p.cancelUrl,
    transaction_type: p.transactionType ?? 'Auth',
    payment_completed_by: 'app', // ödemeyi Halköde tamamlar (ayrıca /complete çağırmayız)
  };

  try {
    const resp = await fetch(`${c.baseUrl}/api/paySmart3D`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const text = await resp.text();

    // Başarı = Halköde'nin BANKAYA auto-submit eden HTML formu; hata = JSON.
    //
    // ⚠️ "HTML geldi = başarı" YETMEZ. Halköde işlemi reddettiğinde bazen JSON
    // değil, `cancel_url`'e bir YÖNLENDİRME döndürüyor; `fetch` yönlendirmeyi
    // kendiliğinden takip ettiği için elimize KENDİ deneme sayfamızın HTML'i
    // geçiyor ve bu "ok: true" sayılıyordu. Ölçüldü (17 Eyl 2026): merchant key
    // bozukken 89 KB'lık "banka formu" döndü — içeriği bizim kendi sayfamızdı,
    // kullanıcı 3D ekranı yerine boş bir sayfaya düşecekti.
    //
    // Gerçek form Halköde'nin kendi alan adına POST eder; ölçüt bu.
    const trimmed = text.trimStart();
    if (trimmed.startsWith('<')) {
      let halkodeHost = '';
      try {
        halkodeHost = new URL(c.baseUrl).host;
      } catch {
        /* baseUrl bozuksa aşağıdaki kontrol zaten elemeyi yapar */
      }
      if (halkodeHost && text.includes(halkodeHost)) return { ok: true, html: text };
      const nereye = resp.redirected ? ` (istek ${resp.url.slice(0, 120)} adresine yönlendi)` : '';
      return {
        ok: false,
        statusCode: -1,
        error:
          `Halköde banka formu yerine beklenmeyen bir sayfa döndürdü${nereye}. ` +
          `Bu genellikle isteğin reddedilip iptal adresine yönlendirildiği anlamına gelir ` +
          `(sık sebep: merchant_key bozuk → "merchant not found").`,
      };
    }

    let json: Json = {};
    try {
      json = JSON.parse(text) as Json;
    } catch {
      // Gövde boş/JSON değil (ör. geçersiz kart no → HTTP 404, boş gövde)
      return { ok: false, statusCode: -1, error: text.slice(0, 500) || `HTTP ${resp.status} (boş yanıt)` };
    }
    const data = (json.data ?? {}) as Json;
    const code = Number(json.status_code ?? data.status_code ?? -1);
    const desc = String(json.status_description ?? data.error ?? data.status_description ?? 'bilinmeyen hata');
    return { ok: false, statusCode: code, error: desc, raw: json };
  } catch (e) {
    return { ok: false, statusCode: -1, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * getpos yanıtındaki tek bir taksit seçeneği (alanlar canlı test yanıtından alındı).
 *
 * ⚠️ TEST ortamında tüm komisyon oranları 0 olduğu için `payable_amount` ile
 * `amount_to_be_paid` her taksitte istenen tutara EŞİT çıkıyor; ikisinin farkı
 * ancak komisyonlu canlı ortamda görülür. Arayüzde müşteriye gösterilecek TOPLAM
 * için `amount_to_be_paid` bağlanmalı (string, 2 hane).
 */
export interface HalkodeInstallment {
  pos_id: number;
  campaign_id: number;
  allocation_id: number;
  installments_number: number;
  card_type: string; // "CREDIT CARD" / "DEBIT CARD"
  card_program: string; // QNB Finansbank CC, MAXIMUM, AXESS, WORLD…
  card_scheme: string; // visa / mastercard / troy
  payable_amount: number; // taksit BAŞINA tutar (dokümana göre)
  amount_to_be_paid: string; // müşterinin ödeyeceği TOPLAM
  currency_code: string;
  currency_id: number;
  title: string | number; // 1 → "Single payment", diğerleri → taksit sayısı
  hash_key?: string;
}

/**
 * Karta tanımlı taksit tablosu. `creditCard` = kart numarasının İLK 6 HANESİ
 * (tarım kartlarında tamamı). Ödeme ekranında taksit seçenekleri bundan basılır.
 */
export async function getPos(
  creditCardBin: string,
  amount: number,
  token: string,
  currencyCode = 'TRY',
  ortam?: HalkodeOrtamSecimi,
): Promise<
  | { ok: true; installments: HalkodeInstallment[] }
  | { ok: false; statusCode: number; error: string }
> {
  const { json } = await postJson(
    '/api/getpos',
    {
      credit_card: creditCardBin.replace(/\s/g, '').slice(0, 6),
      amount,
      currency_code: currencyCode,
      merchant_key: (await cfg(ortam)).merchantKey,
    },
    token,
    ortam,
  );
  const code = Number(json.status_code ?? -1);
  if (code === HALKODE_STATUS.SUCCESS && Array.isArray(json.data)) {
    return { ok: true, installments: json.data as HalkodeInstallment[] };
  }
  return { ok: false, statusCode: code, error: String(json.status_description ?? 'taksit bilgisi alınamadı') };
}

/**
 * İşlem durumu sorgula — 3D dönüşünün SUNUCU tarafı doğrulaması (tek güven kaynağı).
 *
 * ⚠️ ÖLÇÜLDÜ (8 Eyl 2026): checkstatus alanları `data` ALTINDA DEĞİL, yanıtın EN ÜST
 * seviyesinde geliyor (dokümandaki örnek `data` sarmalı gösteriyor). Yalnız `json.data`
 * okunursa başarılı ödeme "tamamlanmadı" sanılır → müşteriden para çekilir ama sipariş
 * açılmaz. Bu yüzden `data` yoksa kökün kendisi kullanılır.
 */
export async function checkStatus(
  invoiceId: string,
  token: string,
  ortam?: HalkodeOrtamSecimi,
): Promise<{ ok: boolean; statusCode: number; description: string; data: Json }> {
  const { json } = await postJson(
    '/api/checkstatus',
    { invoice_id: invoiceId, merchant_key: (await cfg(ortam)).merchantKey },
    token,
    ortam,
  );
  const nested = json.data;
  const data: Json = nested && typeof nested === 'object' && Object.keys(nested as Json).length ? (nested as Json) : json;
  const code = Number(json.status_code ?? -1);
  return {
    ok: code === HALKODE_STATUS.SUCCESS && String(data.transaction_status ?? '').toLowerCase() === 'completed',
    statusCode: code,
    description: String(json.status_description ?? ''),
    data,
  };
}

/**
 * İade / iptal. Halköde ikisi için de AYNI ucu kullanır:
 * tutar işlem tutarının tamamı → iptal, kısmi → iade.
 *
 * ⚠️ İade hash'i ÖDEME hash'inden FARKLI — dokümante edilmemiş, test ortamında
 * ölçüldü (8 Eyl 2026):
 *     data = amount|invoice_id|merchant_key        (2 hane ondalık: "22.00")
 * Ödemedeki `total|installments|currency|merchant_key|invoice_id` burada 68 döner.
 */
export async function refund(
  invoiceId: string,
  amount: number,
  token: string,
  ortam?: HalkodeOrtamSecimi,
): Promise<{ ok: boolean; statusCode: number; description: string; data: Json }> {
  const c = await cfg(ortam);
  const hashKey = encryptBundle([amount.toFixed(2), invoiceId, c.merchantKey].join('|'), c.appSecret);
  const { json } = await postJson(
    '/api/refund',
    {
      invoice_id: invoiceId,
      merchant_key: c.merchantKey,
      amount: Number(amount.toFixed(2)),
      app_id: c.appId,
      app_secret: c.appSecret,
      hash_key: hashKey,
    },
    token,
  );
  const code = Number(json.status_code ?? -1);
  return {
    ok: code === HALKODE_STATUS.SUCCESS,
    statusCode: code,
    description: String(json.status_description ?? ''),
    data: (json.data ?? json) as Json,
  };
}

/** invoice_id'ye draft/sipariş id'sini göm (PayTR merchant_oid deseniyle aynı). */
export function buildInvoiceId(draftOrderId: number | string | null, uniq: string): string {
  return `vm${draftOrderId ?? 0}t${uniq}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);
}

export function parseDraftIdFromInvoiceId(invoiceId: string): string | null {
  const m = /^vm(\d+)t/.exec(invoiceId);
  const id = m?.[1];
  return id && id !== '0' ? id : null;
}
