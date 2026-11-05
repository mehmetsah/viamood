/**
 * #995932 — PDP başlığı (h1) 43.584px → 18px: templates/product.json › text_GnyQiN `type_preset` "h2" → "h5".
 * Canlıya istek gitmez; tema-yamalari/995932-pdp-h1 paketi ölçülür. Çivi: farkın TEK JSON yolu ve TEK satır olması,
 * paketteki yama.py'nin ÖNCESİ'nden SONRASI'nı bayt bayt üretmesi ve md5 kütüğünün dosyalarla tutması.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..', 'tema-yamalari', '995932-pdp-h1');
const oku = (y: string) => readFileSync(join(KOK, y), 'utf8');
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
const ayristir = (s: string) => JSON.parse(s.slice(s.indexOf('{', s.indexOf('*/'))));
const BLOK = ['sections', 'main', 'blocks', 'product-details', 'blocks', 'text_GnyQiN'];
const al = (o: unknown, yol: string[]) => yol.reduce<unknown>((x, k) => (x as Record<string, unknown>)?.[k], o);

function farklar(a: unknown, b: unknown, yol: string[] = []): string[] {
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const ak = a as Record<string, unknown>, bk = b as Record<string, unknown>;
    return [...new Set([...Object.keys(ak), ...Object.keys(bk)])].sort().flatMap(k => farklar(ak[k], bk[k], [...yol, k]));
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [yol.join('.')];
}

describe('#995932 PDP h1 ön ayarı', () => {
  const once = oku('ONCESI/templates__product.json');
  const sonra = oku('SONRASI/templates__product.json');

  it('md5 kütüğü dosyalarla tutuyor (ÖNCESİ = canlıdan okunan 51343646…)', () => {
    const m = JSON.parse(oku('md5.json'));
    expect(md5(once)).toBe(m.once);
    expect(md5(sonra)).toBe(m.sonra);
    expect(m.once).toBe('51343646fd65b43e985fc483ec708bc3');
  });

  it('JSON farkı YALNIZ başlık bloğunun type_preset alanı: h2 → h5', () => {
    const o = ayristir(once), s = ayristir(sonra);
    expect(farklar(o, s)).toEqual([[...BLOK, 'settings', 'type_preset'].join('.')]);
    expect(al(o, [...BLOK, 'settings', 'type_preset'])).toBe('h2');
    expect(al(s, [...BLOK, 'settings', 'type_preset'])).toBe('h5');
    expect(al(s, [...BLOK, 'settings', 'text'])).toBe('<h1>{{ closest.product.title }}</h1>');
    expect(al(s, [...BLOK, 'settings', 'font_size'])).toBe('');
  });

  it('metin farkı tek satır; satır sayısı ve kalan baytlar aynı', () => {
    const o = once.split('\n'), s = sonra.split('\n');
    expect(s.length).toBe(o.length);
    const degisen = o.map((x, i) => (x === s[i] ? -1 : i)).filter(i => i >= 0);
    expect(degisen).toHaveLength(1);
    const i = degisen[0] ?? -1;
    expect(o[i]?.trim()).toBe('"type_preset": "h2",');
    expect(s[i]?.trim()).toBe('"type_preset": "h5",');
  });

  it('yama.py ÖNCESİ\'nden SONRASI\'nı bayt bayt üretiyor ve ikinci uygulamayı reddediyor', () => {
    const kos = (girdi: string) => execFileSync('python3', ['-I', '-B', '-c',
      'import sys; sys.path.insert(0, sys.argv[1]); import yama; sys.stdout.write(yama.uygula(yama.K, sys.stdin.read()))', KOK],
      { input: girdi, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    expect(md5(kos(once))).toBe(md5(sonra));
    expect(() => kos(sonra)).toThrow(/çapa 0 kez/);
  });

  it('yama.py yapısal kapısı: çapa tutsa bile ikinci bir JSON alanı değişirse yazmaz', () => {
    expect(() => execFileSync('python3', ['-I', '-B', '-c',
      'import sys; sys.path.insert(0, sys.argv[1]); import yama; yama.YENI = yama.YENI.replace(\'"left"\', \'"center"\'); yama.uygula(yama.K, sys.stdin.read())', KOK],
      { input: once, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })).toThrow(/beklenmeyen JSON farkı/);
  });
});
