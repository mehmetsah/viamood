/**
 * #992334 — davet zincirinin son iki halkası.
 * (a) /auth/davet middleware AÇIK YOLLAR listesinde olmalı,
 * (b) davet e-postası şablonu + gönderim bağlı olmalı, link log'lanmamalı.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MW = readFileSync('src/middleware.ts', 'utf8');
const TPL = readFileSync('src/lib/email/templates.ts', 'utf8');
const ACTION = readFileSync('src/lib/actions/davet-olustur.ts', 'utf8');
const kodu = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('ÖLÇÜLEN KIRIK: /auth/davet oturumsuz açılabilmeli', () => {
  it('PUBLIC_PATHS içinde /auth/davet VAR', () => {
    const m = MW.match(/PUBLIC_PATHS = new Set\(\[([\s\S]*?)\]\)/);
    expect(m, 'PUBLIC_PATHS bulunamadı').toBeTruthy();
    expect(kodu(m![1])).toContain("'/auth/davet'");
  });
  it('kardeş yol /auth/sifre-sifirla da listede (referans değişmez)', () => {
    const m = MW.match(/PUBLIC_PATHS = new Set\(\[([\s\S]*?)\]\)/);
    expect(kodu(m![1])).toContain("'/auth/sifre-sifirla'");
  });
  it('NEGATİF: /admin/davet public DEĞİL — davet ÜRETME ekranı açık olamaz', () => {
    const m = MW.match(/PUBLIC_PATHS = new Set\(\[([\s\S]*?)\]\)/);
    expect(kodu(m![1])).not.toContain("'/admin/davet'");
  });
});

describe('davet e-postası', () => {
  it('şablon var ve süre PARAMETREDEN gelir (koda gömülü değil)', () => {
    expect(TPL).toContain('export function daveteEmail(');
    expect(TPL).toContain('${p.saat} saat');
  });
  it('NEGATİF: "şifre sıfırlama" dili KULLANILMAZ — davet edilenin hesabı yok', () => {
    const govde = TPL.slice(TPL.indexOf('export function daveteEmail('),
                            TPL.indexOf('export function vendorWelcomeEmail('));
    expect(kodu(govde)).not.toMatch(/sıfırla/i);
  });
  it('gönderim action’a bağlı ve tek kullanım/süre metni var', () => {
    expect(ACTION).toContain('daveteEmail(');
    expect(ACTION).toContain('sendEmail(');
    expect(ACTION).toContain('DAVET_OMRU_SAAT');
  });
  it('DEĞİŞMEZ: mail düşse bile link geçerli kalır (ok:true dönüyor)', () => {
    expect(ACTION).toMatch(/mail = 'basarisiz'/);
    expect(ACTION).toMatch(/return \{ ok: true, link: sonuc\.link/);
  });
  it('NEGATİF: ham link hâlâ LOG’LANMIYOR', () => {
    expect(kodu(ACTION)).not.toMatch(/console\./);
  });
});
