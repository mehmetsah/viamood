/**
 * Ortam bayrakları — kill switch gerçekten KAPATABİLİYOR mu?
 *
 * ARKA PLAN: `z.coerce.boolean()` içeride `Boolean(v)` çağırıyor ve
 * `Boolean('false') === true`. Yani `MIKRO_AUTO_PUSH=false` yazmak bayrağı
 * kapatmıyor, AÇIK bırakıyordu. Dosyada üç yerde "z.coerce.boolean KULLANMA"
 * uyarısı vardı ama dört bayrak hâlâ onu kullanıyordu:
 *   MIKRO_AUTO_PUSH · MIKRO_PUSH_ON_ORDER · KARGOLAB_AUTO_LABEL · MIKRO_FIRMA_PUSH
 *
 * Üçünün varsayılanı `true` — yani Mikro/KargoLab çökse bile env'den
 * durdurulamıyorlardı. 15 Eyl 2026 ölçümü: 'false' → true, '0' → true.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BAYRAKLAR = [
  'MIKRO_AUTO_PUSH',
  'MIKRO_PUSH_ON_ORDER',
  'KARGOLAB_AUTO_LABEL',
  'MIKRO_FIRMA_PUSH',
] as const;

/** Varsayılanları — değişken TANIMSIZ iken beklenen değer (davranış korunmalı). */
const VARSAYILAN: Record<(typeof BAYRAKLAR)[number], boolean> = {
  MIKRO_AUTO_PUSH: true,
  MIKRO_PUSH_ON_ORDER: false,
  KARGOLAB_AUTO_LABEL: true,
  MIKRO_FIRMA_PUSH: true,
};

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

async function envYukle() {
  vi.resetModules();
  const mod = await import('@/lib/env');
  return mod.env as Record<string, unknown>;
}

describe('ortam bayrakları — kapatılabilirlik', () => {
  let yedek: Record<string, string | undefined>;

  beforeEach(() => {
    const anahtarlar = [...BAYRAKLAR, ...Object.keys(ZORUNLU_ENV)];
    yedek = Object.fromEntries(anahtarlar.map((a) => [a, process.env[a]]));
    for (const a of BAYRAKLAR) delete process.env[a];
    for (const [k, v] of Object.entries(ZORUNLU_ENV)) process.env[k] ??= v;
  });

  afterEach(() => {
    for (const [a, v] of Object.entries(yedek)) {
      if (v === undefined) delete process.env[a];
      else process.env[a] = v;
    }
  });

  for (const ad of BAYRAKLAR) {
    it(`${ad}: 'false' GERÇEKTEN kapatır (eski kusur)`, async () => {
      process.env[ad] = 'false';
      expect((await envYukle())[ad]).toBe(false);
    });

    it(`${ad}: '0' kapatır`, async () => {
      process.env[ad] = '0';
      expect((await envYukle())[ad]).toBe(false);
    });

    it(`${ad}: 'true' açar, '1' açar`, async () => {
      process.env[ad] = 'true';
      expect((await envYukle())[ad]).toBe(true);
      process.env[ad] = '1';
      expect((await envYukle())[ad]).toBe(true);
    });

    it(`${ad}: TANIMSIZ iken varsayılan korunur (${VARSAYILAN[ad]})`, async () => {
      delete process.env[ad];
      expect((await envYukle())[ad]).toBe(VARSAYILAN[ad]);
    });
  }

  it('prod’daki gerçek değerle davranış DEĞİŞMİYOR (MIKRO_AUTO_PUSH=true)', async () => {
    // 15 Eyl 2026 ölçümü: .env.production → MIKRO_AUTO_PUSH=true,
    // diğer üçü tanımsız. Bu düzeltme prod davranışını değiştirmemeli.
    process.env.MIKRO_AUTO_PUSH = 'true';
    const env = await envYukle();
    expect(env.MIKRO_AUTO_PUSH).toBe(true);
    expect(env.MIKRO_PUSH_ON_ORDER).toBe(false);
    expect(env.KARGOLAB_AUTO_LABEL).toBe(true);
    expect(env.MIKRO_FIRMA_PUSH).toBe(true);
  });
});
