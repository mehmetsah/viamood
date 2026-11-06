/**
 * #995977 kalem 4 — tek varyantlı ürün varyant seçiciyi BASMAZ (snippets/variant-main-picker.liquid satır 12).
 * Canlıya istek gitmez; paket ölçülür. Liquid koşulu küçük bir yorumlayıcıyla üç ürün tipinde koşturulur.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..', 'tema-yamalari', '995977-k4-default-title');
const oku = (y: string) => readFileSync(join(KOK, y), 'utf8');
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
const pyKos = (kod: string, girdi: string) => execFileSync('python3', ['-I', '-B', '-c',
  'import sys; sys.path.insert(0, sys.argv[1]); import yama\n' + kod, KOK], { input: girdi, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

type Urun = { has_only_default_variant: boolean; variants: { size: number } };
/** Dosyanın İLK `{% unless … %}` koşulunu okur ve ürün için değerlendirir: true ⇒ seçici BASILIR. */
function seciciBasilir(liquid: string, p: Urun): boolean {
  const m = liquid.match(/\{% unless (.+?) %\}/);
  if (!m) throw new Error('unless yok');
  const deger = (terim: string): boolean => {
    const t = terim.trim();
    if (t === 'product_resource.has_only_default_variant') return p.has_only_default_variant;
    const e = t.match(/^product_resource\.variants\.size == (\d+)$/);
    if (e) return p.variants.size === Number(e[1]);
    throw new Error('bilinmeyen terim: ' + t);
  };
  return !(m[1] ?? '').split(' or ').some(deger);
}
const DOGRU_KAYITLI_TEK: Urun = { has_only_default_variant: true, variants: { size: 1 } };   // 374 ürün: seçenek «Title»
const YANLIS_KAYITLI_TEK: Urun = { has_only_default_variant: false, variants: { size: 1 } }; // 100 ürün: seçenek «Default Title»
const COK: Urun = { has_only_default_variant: false, variants: { size: 6 } };                  // 18 ürün

describe('#995977 kalem 4 paketi', () => {
  const o = oku('ONCESI/snippets__variant-main-picker.liquid'), s = oku('SONRASI/snippets__variant-main-picker.liquid');
  const m = JSON.parse(oku('md5.json'));

  it('md5 kütüğü dosyalarla tutuyor', () => {
    expect(md5(o)).toBe(m.once);
    expect(md5(s)).toBe(m.sonra);
  });

  it('ÖNCE: «Default Title» adlı seçenekle kaydedilmiş tek varyantlı ürün seçiciyi BASIYORDU (hata ölçülebilir)', () => {
    expect(seciciBasilir(o, YANLIS_KAYITLI_TEK)).toBe(true);
    expect(seciciBasilir(o, DOGRU_KAYITLI_TEK)).toBe(false);
  });

  it('SONRA: tek varyantlı ürün (iki kayıt biçiminde de) seçiciyi BASMAZ; çok varyantlıda AYNEN basar', () => {
    expect(seciciBasilir(s, YANLIS_KAYITLI_TEK)).toBe(false);
    expect(seciciBasilir(s, DOGRU_KAYITLI_TEK)).toBe(false);
    expect(seciciBasilir(s, COK)).toBe(true);
    expect(seciciBasilir(o, COK)).toBe(true);
  });

  it('dosyada yalnız koşul satırı değişti (+ iki satır yorum); unless/endunless dengesi aynı', () => {
    const a = o.split('\n'), b = s.split('\n');
    expect(b.length - a.length).toBe(2);
    const cikan = a.filter(x => !b.includes(x)), giren = b.filter(x => !a.includes(x));
    expect(cikan).toEqual(['{% unless product_resource.has_only_default_variant %}']);
    expect(giren.filter(x => !/comment|has_only_default_variant onlarda/.test(x))).toEqual(['{% unless product_resource.has_only_default_variant or product_resource.variants.size == 1 %}']);
    expect((s.match(/\{% endunless %\}/g) || []).length).toBe((o.match(/\{% endunless %\}/g) || []).length);
  });

  it('yama.py ÖNCESİ\'nden SONRASI\'nı bayt bayt üretiyor ve ikinci uygulamayı reddediyor', () => {
    expect(md5(pyKos('sys.stdout.write(yama.uygula(yama.K, sys.stdin.read()))', o))).toBe(md5(s));
    expect(() => pyKos('yama.uygula(yama.K, sys.stdin.read())', s)).toThrow(/çapa 0 kez/);
  });

  it('yama.py denge kapısı: yeni satır fazladan unless açarsa yazmaz', () => {
    expect(() => pyKos('yama.YENI = yama.YENI + "{% unless true %}\\n"; yama.uygula(yama.K, sys.stdin.read())', o)).toThrow(/dengesi/);
  });
});
