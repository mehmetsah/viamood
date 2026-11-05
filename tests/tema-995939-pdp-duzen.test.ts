/**
 * #995939 · ayse:858 — PDP %50/%50: templates/product.json equal_columns false→true + via-product-overrides.css'te
 * 540px tavanının YALNIZ yarım ızgarada kalkması. Canlıya istek gitmez; tema-yamalari/995939-pdp-duzen paketi ölçülür.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..', 'tema-yamalari', '995939-pdp-duzen');
const oku = (y: string) => readFileSync(join(KOK, y), 'utf8');
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
const ayristir = (s: string) => JSON.parse(s.slice(s.indexOf('{')));
const al = (o: unknown, yol: string[]) => yol.reduce<unknown>((x, k) => (x as Record<string, unknown>)?.[k], o);
function farklar(a: unknown, b: unknown, yol: string[] = []): string[] {
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const ak = a as Record<string, unknown>, bk = b as Record<string, unknown>;
    return [...new Set([...Object.keys(ak), ...Object.keys(bk)])].sort().flatMap(k => farklar(ak[k], bk[k], [...yol, k]));
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [yol.join('.')];
}
const pyKos = (kod: string, girdi: string) => execFileSync('python3', ['-I', '-B', '-c',
  'import sys; sys.path.insert(0, sys.argv[1]); import yama\n' + kod, KOK], { input: girdi, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

describe('#995939 PDP %50/%50 paketi', () => {
  const tO = oku('ONCESI/templates__product.json'), tS = oku('SONRASI/templates__product.json');
  const cO = oku('ONCESI/assets__via-product-overrides.css'), cS = oku('SONRASI/assets__via-product-overrides.css');
  const m = JSON.parse(oku('md5.json'));

  it('md5 kütüğü dosyalarla tutuyor; şablon ÖNCESİ = #995932 SONRASI (cf7c0cf0…)', () => {
    expect(md5(tO)).toBe(m['templates/product.json'].once);
    expect(md5(tS)).toBe(m['templates/product.json'].sonra);
    expect(md5(cO)).toBe(m['assets/via-product-overrides.css'].once);
    expect(md5(cS)).toBe(m['assets/via-product-overrides.css'].sonra);
    expect(m['templates/product.json'].once).toBe('cf7c0cf059ebf9cab39c3f84f6d38e82');
  });

  it('şablonda JSON farkı YALNIZ main.settings.equal_columns false → true; #995932 başlık ön ayarı h5 kalır', () => {
    const o = ayristir(tO), s = ayristir(tS);
    expect(farklar(o, s)).toEqual(['sections.main.settings.equal_columns']);
    expect(al(o, ['sections', 'main', 'settings', 'equal_columns'])).toBe(false);
    expect(al(s, ['sections', 'main', 'settings', 'equal_columns'])).toBe(true);
    expect(al(s, ['sections', 'main', 'settings', 'limit_details_width'])).toBe(false);
    expect(al(s, ['sections', 'main', 'blocks', 'product-details', 'blocks', 'text_GnyQiN', 'settings', 'type_preset'])).toBe('h5');
  });

  it('CSS: yalnız EKLEME — ÖNCESİ satırları sırasıyla aynen duruyor, 1. satırdaki 540px ortak kural değişmedi', () => {
    const o = cO.split('\n'), s = cS.split('\n');
    expect(s[0]).toBe(o[0]);
    expect(s[0]).toContain('media-gallery{max-width:540px!important');
    let j = 0; for (const satir of s) if (j < o.length && satir === o[j]) j++;
    expect(j).toBe(o.length);
    expect(s.length - o.length).toBe(20);
  });

  it('CSS: yeni kural yalnız --half ızgarada, yalnız ≥761px, yalnız max-width', () => {
    const blok = cS.slice(cS.indexOf('#995939'));
    const kural = blok.slice(blok.indexOf('@media'), blok.indexOf('}\n}\n') + 4);
    expect(kural).toMatch(/^@media screen and \(min-width: 761px\) \{/);
    const seciciler = kural.slice(kural.indexOf('{') + 1, kural.indexOf('{', kural.indexOf('{') + 1)).split(',').map(x => x.trim());
    expect(seciciler).toEqual(['.product-information__grid--half .product-information__media', '.product-information__grid--half media-gallery']);
    const govde = kural.slice(kural.indexOf('{', kural.indexOf('{') + 1) + 1, kural.indexOf('}')).trim();
    expect(govde).toBe('max-width: none !important;');
  });

  it('yama.py iki dosyada da ÖNCESİ\'nden SONRASI\'nı bayt bayt üretiyor ve ikinci uygulamayı reddediyor', () => {
    expect(md5(pyKos('sys.stdout.write(yama.uygula(yama.TPL, sys.stdin.read()))', tO))).toBe(md5(tS));
    expect(md5(pyKos('sys.stdout.write(yama.uygula(yama.CSS, sys.stdin.read()))', cO))).toBe(md5(cS));
    expect(() => pyKos('yama.uygula(yama.TPL, sys.stdin.read())', tS)).toThrow(/çapa 0 kez/);
    expect(() => pyKos('yama.uygula(yama.CSS, sys.stdin.read())', cS)).toThrow(/zaten var/);
  });

  it('yama.py yapısal kapısı: şablonda ikinci bir JSON alanı değişirse yazmaz', () => {
    expect(() => pyKos('yama.TPL_YENI = yama.TPL_YENI.replace("true,", "true, \\"via_sahte\\": 1,"); yama.uygula(yama.TPL, sys.stdin.read())', tO)).toThrow(/beklenmeyen JSON farkı/);
  });
});
