/**
 * #995977 · ayse:858 iki ayak — (1) via-mobile-app.css ≤749px ÜRÜN DETAY kuralında [class*="product-information"]
 * sızıntısı kalkar, (2) templates/product.cok-al.json equal_columns false→true. Canlıya istek gitmez; paket ölçülür.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..', 'tema-yamalari', '995977-mobil-cokal');
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
// yorumları atılmış CSS: kural metinleri (seçici → gövde) sırayla
const kurallar = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const pyKos = (kod: string, girdi: string) => execFileSync('python3', ['-I', '-B', '-c',
  'import sys; sys.path.insert(0, sys.argv[1]); import yama\n' + kod, KOK], { input: girdi, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

describe('#995977 paket', () => {
  const cO = oku('ONCESI/assets__via-mobile-app.css'), cS = oku('SONRASI/assets__via-mobile-app.css');
  const tO = oku('ONCESI/templates__product.cok-al.json'), tS = oku('SONRASI/templates__product.cok-al.json');
  const m = JSON.parse(oku('md5.json'));

  it('md5 kütüğü dosyalarla tutuyor', () => {
    expect(md5(cO)).toBe(m['assets/via-mobile-app.css'].once);
    expect(md5(cS)).toBe(m['assets/via-mobile-app.css'].sonra);
    expect(md5(tO)).toBe(m['templates/product.cok-al.json'].once);
    expect(md5(tS)).toBe(m['templates/product.cok-al.json'].sonra);
  });

  it('AYAK 1: kural metninde [class*="product-information"] YOK; .product-information ve .product-page 112px\'i AYNEN', () => {
    expect(kurallar(cO)).toContain('[class*="product-information"]');
    expect(kurallar(cS)).not.toContain('[class*="product-information"]');
    expect(kurallar(cS)).toMatch(/\.product-information,\s*\.product-page \{\s*padding-bottom: 112px !important;\s*\}/);
  });

  it('AYAK 1: başka hiçbir kural değişmedi — yorumsuz CSS farkı yalnız o seçici satırı', () => {
    const o = kurallar(cO).split('\n').filter(s => s.trim()), s = kurallar(cS).split('\n').filter(s => s.trim());
    const cikan = o.filter(x => !s.includes(x)), giren = s.filter(x => !o.includes(x));
    expect(cikan.map(x => x.trim())).toEqual(['.product-page,', '[class*="product-information"] {']);
    expect(giren.map(x => x.trim())).toEqual(['.product-page {']);
  });

  it('AYAK 1: CTA öncesi boşluk (buy-buttons) ve öteki mobil kurallar dokunulmadı', () => {
    const bb = (c: string) => (c.match(/[^{}]*buy-buttons[^{}]*\{[^}]*\}/g) || []).join('\n');
    expect(bb(cS)).toBe(bb(cO));
    expect(bb(cS).length).toBeGreaterThan(0);
  });

  it('AYAK 2: çok-al şablonunda JSON farkı YALNIZ main.settings.equal_columns false → true', () => {
    const o = ayristir(tO), s = ayristir(tS);
    expect(farklar(o, s)).toEqual(['sections.main.settings.equal_columns']);
    expect(al(o, ['sections', 'main', 'settings', 'equal_columns'])).toBe(false);
    expect(al(s, ['sections', 'main', 'settings', 'equal_columns'])).toBe(true);
  });

  it('yama.py iki dosyada ÖNCESİ\'nden SONRASI\'nı bayt bayt üretiyor ve ikinci uygulamayı reddediyor', () => {
    expect(md5(pyKos('sys.stdout.write(yama.uygula(yama.CSS, sys.stdin.read()))', cO))).toBe(md5(cS));
    expect(md5(pyKos('sys.stdout.write(yama.uygula(yama.TPL, sys.stdin.read()))', tO))).toBe(md5(tS));
    expect(() => pyKos('yama.uygula(yama.CSS, sys.stdin.read())', cS)).toThrow(/çapa 0 kez/);
    expect(() => pyKos('yama.uygula(yama.TPL, sys.stdin.read())', tS)).toThrow(/çapa 0 kez/);
  });

  it('yama.py kapıları: şablonda ikinci alan ya da CSS\'te sızıntı seçicisi kalırsa yazmaz', () => {
    expect(() => pyKos('yama.TPL_YENI = yama.TPL_YENI.replace("true,", "true, \\"via_sahte\\": 1,"); yama.uygula(yama.TPL, sys.stdin.read())', tO)).toThrow(/beklenmeyen JSON farkı/);
    expect(() => pyKos('yama.CSS_YENI = yama.CSS_YENI.replace(".product-page {", ".product-page,\\n  [class*=\\"product-information\\"] {"); yama.uygula(yama.CSS, sys.stdin.read())', cO)).toThrow(/sızıntı seçicisi/);
  });
});
