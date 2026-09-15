/**
 * Regresyon — Google giriş akışının iki kırılma noktası.
 *
 * İkisi de 15 Eyl'de canlıda yaşandı: giriş çalışmadı çünkü
 *  (1) callback yolu middleware'e takıldı,
 *  (2) ayarlı AUTH_URL trustHost'u ezdi.
 * Bu test ikisini de kaynağın kendisinden okuyarak çivileniyor.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const oku = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('callback yolu middleware’e takılmamalı', () => {
  const CALLBACK = '/auth/google/callback';

  it('middleware.ts PUBLIC_PATHS içinde', () => {
    const src = oku('src/middleware.ts');
    const blok = src.slice(src.indexOf('const PUBLIC_PATHS'), src.indexOf(']);', src.indexOf('const PUBLIC_PATHS')));
    expect(blok).toContain(CALLBACK);
  });

  it('auth.config.ts PUBLIC_PATHS kopyasında da var (edge tarafı)', () => {
    const src = oku('src/lib/auth.config.ts');
    const blok = src.slice(src.indexOf('PUBLIC_PATHS'), src.indexOf(']);', src.indexOf('PUBLIC_PATHS')));
    expect(blok).toContain(CALLBACK);
  });

  it('köprü rotası gerçekten var', () => {
    expect(() => oku('src/app/auth/google/callback/route.ts')).not.toThrow();
  });

  it('köprü NextAuth ucuna yönlendiriyor', () => {
    expect(oku('src/app/auth/google/callback/route.ts')).toContain('/api/auth/callback/google');
  });
});

describe('AUTH_URL trustHost’u ezmemeli', () => {
  it('env.ts’te AUTH_URL varsayılansız (optional)', () => {
    const src = oku('src/lib/env.ts');
    expect(src).toMatch(/AUTH_URL:\s*z\.string\(\)\.url\(\)\.optional\(\)/);
    // Eski hâli geri gelirse test düşsün:
    expect(src).not.toMatch(/AUTH_URL:\s*z\.string\(\)\.url\(\)\.default\(/);
  });

  it('localhost temizleyicisi var ve parse’tan ÖNCE koşuyor', () => {
    const src = oku('src/lib/env.ts');
    expect(src).toContain('function temizleAuthUrl');
    expect(src.indexOf('temizleAuthUrl()')).toBeLessThan(src.indexOf('envSchema.safeParse'));
  });

  it('auth.config.ts’te trustHost açık', () => {
    expect(oku('src/lib/auth.config.ts')).toMatch(/trustHost:\s*true/);
  });
});

describe('temizleme mantığı — davranış', () => {
  /** env.ts'teki temizleAuthUrl ile AYNI kural. */
  function dusurulurMu(v?: string): boolean {
    const ham = (v ?? '').trim();
    if (!ham) return false;
    return /localhost|127\.0\.0\.1/i.test(ham);
  }

  it.each([
    'https://localhost:4001',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ])('localhost adresi düşürülür: %s', (v) => expect(dusurulurMu(v)).toBe(true));

  it.each([
    'https://hesap.viamood.com.tr',
    'https://viamood.com.tr',
  ])('gerçek adrese DOKUNULMAZ: %s', (v) => expect(dusurulurMu(v)).toBe(false));

  it('tanımsız AUTH_URL zaten düşürülecek bir şey değil', () => {
    expect(dusurulurMu(undefined)).toBe(false);
    expect(dusurulurMu('')).toBe(false);
  });
});
