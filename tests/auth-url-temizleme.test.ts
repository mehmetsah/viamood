/**
 * `temizleAuthUrl()` regresyon testleri — GERÇEK fonksiyonu koşturur.
 *
 * ARKA PLAN: 34b75ec'te yazdığım ilk sürüm `AUTH_URL` tanımsızsa hemen dönüyor,
 * eski adı (`NEXTAUTH_URL`) hiç temizlemiyordu. Prod'da yalnız `NEXTAUTH_URL`
 * tanımlı olduğu için düzeltme canlıda ETKİSİZ kaldı — 15 Eyl 2026 ölçümünde
 * `/api/auth/providers` hâlâ `https://localhost:4001` gösteriyordu ve uyarı
 * log'u hiç basılmamıştı. 3 numaralı test tam olarak o senaryoyu çiviliyor.
 *
 * NEDEN KAYNAK OKUMA DEĞİL: `auth-public-paths.test.ts` bu kuralı kaynak metni
 * üzerinden, kendi KOPYASIYLA doğruluyor. Kusur tam da bu yüzden kaçtı —
 * kopyadaki kural doğruydu, çalışan fonksiyon değildi. Burada modülün kendisi
 * yükleniyor ve gerçek `process.env` üzerindeki etkisi ölçülüyor.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ADLAR = ['AUTH_URL', 'NEXTAUTH_URL'] as const;

/** env.ts modül düzeyinde zod doğrulaması yapıyor; eksikse `throw` ediyor. */
const ZORUNLU_ENV: Record<string, string> = {
  DATABASE_URL: 'postgres://kullanici:parola@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  AUTH_SECRET: 'test-amacli-en-az-otuz-iki-karakterlik-gizli-dizi',
  SHOPIFY_STORE_DOMAIN: 'test.myshopify.com',
  HALKODE_ENABLED: 'false',
  COD_ENABLED: 'true',
  COD_AUTO_PAID_ON_DELIVERY: 'false',
  COD_AUTO_PAID_DRY_RUN: 'true',
};

/**
 * Modülü TAZE yükler ve yüklenme sırasında düşürülen değişkenleri döndürür.
 *
 * Temizleme modül düzeyinde, `envSchema.safeParse`'tan ÖNCE koşuyor — prod'da
 * da böyle. Bu yüzden fonksiyonu elle çağırmak yerine gerçek yükleme etkisini
 * ölçüyoruz; elle ikinci çağrı zaten silinmiş değişkenleri görür.
 */
async function yukle(): Promise<string[]> {
  vi.resetModules();
  const mod = await import('@/lib/env');
  return mod.dusurulenAuthUrl;
}

describe('temizleAuthUrl', () => {
  let yedek: Record<string, string | undefined>;

  beforeEach(() => {
    const anahtarlar = [...ADLAR, ...Object.keys(ZORUNLU_ENV)];
    yedek = Object.fromEntries(anahtarlar.map((a) => [a, process.env[a]]));
    for (const a of ADLAR) delete process.env[a];
    for (const [k, v] of Object.entries(ZORUNLU_ENV)) process.env[k] ??= v;
  });

  afterEach(() => {
    for (const [a, v] of Object.entries(yedek)) {
      if (v === undefined) delete process.env[a];
      else process.env[a] = v;
    }
  });

  it('1) AUTH_URL localhost ise düşürür', async () => {
    process.env.AUTH_URL = 'https://localhost:4001';
    const dusen = await yukle();
    expect(process.env.AUTH_URL).toBeUndefined();
    expect(dusen.join(' ')).toContain('AUTH_URL');
  });

  it('2) gerçek bir AUTH_URL varsa DOKUNMAZ', async () => {
    process.env.AUTH_URL = 'https://hesap.viamood.com.tr';
    const dusen = await yukle();
    expect(process.env.AUTH_URL).toBe('https://hesap.viamood.com.tr');
    expect(dusen).toHaveLength(0);
  });

  it('3) YALNIZ NEXTAUTH_URL tanımlıysa da düşürür (canlıdaki arıza)', async () => {
    process.env.NEXTAUTH_URL = 'https://localhost:4001';
    const dusen = await yukle();
    expect(process.env.NEXTAUTH_URL).toBeUndefined();
    expect(dusen.join(' ')).toContain('NEXTAUTH_URL');
  });

  it('4) ikisi de localhost ise ikisini birden düşürür', async () => {
    process.env.AUTH_URL = 'http://127.0.0.1:3000';
    process.env.NEXTAUTH_URL = 'https://localhost:4001';
    const dusen = await yukle();
    expect(process.env.AUTH_URL).toBeUndefined();
    expect(process.env.NEXTAUTH_URL).toBeUndefined();
    expect(dusen).toHaveLength(2);
  });

  it('5) gerçek NEXTAUTH_URL korunur, localhost AUTH_URL düşer', async () => {
    process.env.AUTH_URL = 'https://localhost:4001';
    process.env.NEXTAUTH_URL = 'https://hesap.viamood.com.tr';
    const dusen = await yukle();
    expect(process.env.AUTH_URL).toBeUndefined();
    expect(process.env.NEXTAUTH_URL).toBe('https://hesap.viamood.com.tr');
    expect(dusen).toHaveLength(1);
  });

  it('6) hiçbiri tanımlı değilse sessizce boş döner', async () => {
    expect(await yukle()).toHaveLength(0);
  });
});
