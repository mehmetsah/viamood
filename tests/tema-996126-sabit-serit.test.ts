/** #996126 · ayse:888 — ürün sayfası sabit satın alma şeridi, YALNIZ MASAÜSTÜ (≥750; Yunus 9 Kas 11:20 «Sadece Pc için»).
 *  Telefon (≤749) canlıda birebir aynı kalmalı: yama yalnız EKLER ve eklediği her kural min-width ≥750 içindedir. Canlıya istek yok. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..', 'tema-yamalari', '996126-sabit-serit');
const oku = (y: string) => readFileSync(join(KOK, y), 'utf8');
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
const py = (kod: string, girdi: string) => execFileSync('python3', ['-I', '-B', '-c', 'import sys; sys.path.insert(0, sys.argv[1]); import yama\n' + kod, KOK], { input: girdi, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const F = 'assets__via-product-overrides.css';
const yorumsuz = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const B = 'sticky-add-to-cart[data-variant-available="true"]';
// Üst düzey blokları (ilk süslü parantez düzeyi) ayır: [başlık, gövde].
const ustBloklar = (css: string) => {
  const out: [string, string][] = []; let d = 0, bas = 0, ac = -1;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') { if (d === 0) ac = i; d++; } else if (css[i] === '}') { d--; if (d === 0) { out.push([css.slice(bas, ac).trim(), css.slice(ac + 1, i)]); bas = i + 1; } }
  }
  expect(css.slice(bas).trim()).toBe('');
  return out;
};

describe('#996126 sabit şerit — yalnız masaüstü', () => {
  const m = JSON.parse(oku('md5.json'));
  const o = oku('ONCESI/' + F), s = oku('SONRASI/' + F);
  // Tek ekleme: ortak önek + ortak sonek ÖNCESİ'nin tamamını kaplar.
  let p = 0; while (p < o.length && o[p] === s[p]) p++;
  let q = 0; while (q < o.length - p && o[o.length - 1 - q] === s[s.length - 1 - q]) q++;
  const ek = s.slice(p, s.length - q);

  it('paket tek dosya: via-mobile-app.css kapsamdan çıktı (SIRA · md5.json · ONCESI/SONRASI)', () => {
    expect(Object.keys(m)).toEqual(['assets/via-product-overrides.css']);
    expect(md5(o)).toBe(m['assets/via-product-overrides.css'].once); expect(md5(s)).toBe(m['assets/via-product-overrides.css'].sonra);
    expect(readdirSync(join(KOK, 'ONCESI'))).toEqual([F]); expect(readdirSync(join(KOK, 'SONRASI'))).toEqual([F]);
    expect(existsSync(join(KOK, 'YENI'))).toBe(false);
    expect(py('sys.stdout.write(",".join(yama.SIRA))', '')).toBe('assets/via-product-overrides.css');
    expect(oku('yama.py')).not.toMatch(/via-mobile-app\.css'|MOB\s*=/);
  });

  it('telefon aynı: ÖNCESİ SONRASI içinde bayt bayt duruyor, yalnız TEK ekleme var ve ≤359 bloğunun hemen arkasında', () => {
    expect(p + q).toBeGreaterThanOrEqual(o.length);
    expect(s).toBe(o.slice(0, p) + ek + o.slice(p));
    const kuyruk = '@media (max-width:359px){\n  ' + B + ' .sticky-add-to-cart__bar{grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:"satir satir satir" "bilgi hemen sepet" "fiyat hemen sepet";column-gap:8px}\n  ' + B + ' .sticky-add-to-cart__image{display:none}\n}\n';
    expect(o.slice(0, p).endsWith(kuyruk)).toBe(true);
    expect(s).toContain('@media (max-width:749px){\n  ' + B + ' .sticky-add-to-cart__bar{column-gap:12px}\n  .sticky-add-to-cart__hemen{padding:0 16px;font-size:14px;font-weight:700;border-radius:10px}\n}\n');
    expect(s).toContain(B + ' .sticky-add-to-cart__bar{display:grid;grid-template-columns:52px minmax(0,1fr) auto auto;');
  });

  it('eklenen HER kural min-width ≥750 medya bloğu içinde ve yalnız şeridi hedefliyor; yeni renk yok', () => {
    const bloklar = ustBloklar(yorumsuz(ek));
    expect(bloklar.map((b) => b[0])).toEqual(['@media (min-width:750px)', '@media (min-width:750px) and (max-width:1023px)', '@media (min-width:1024px)']);
    for (const [bas, govde] of bloklar) {
      expect(Number(bas.match(/min-width:(\d+)px/)![1])).toBeGreaterThanOrEqual(750);
      const ic = ustBloklar(govde); expect(ic.length).toBeGreaterThan(0);
      for (const [secici, g] of ic) { for (const x of secici.split(',')) expect(x).toContain('sticky-add-to-cart'); expect(g).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/); }
    }
  });

  it('masaüstü: ad tam · görsel 65 · genişlik min(1440, %100 − 192) · 750–1023 ad kendi sırasında · ≥1024 düğmeler ≥176', () => {
    expect(65).toBe(52 * 1.25); expect(192).toBe(2 * (20 + 60 + 16));
    const e = yorumsuz(ek);
    expect(e).toContain(B + ' .sticky-add-to-cart__bar{grid-template-columns:65px minmax(0,1fr) auto auto;width:min(1440px,calc(100% - 192px));padding:16px 32px}');
    expect(e).toContain(B + ' .sticky-add-to-cart__image{width:65px;height:65px}');
    expect(e).toContain(B + ' .sticky-add-to-cart__title{display:block;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:break-word}');
    expect(e).toContain('.sticky-add-to-cart__bar > .vks-satir{margin-bottom:16px !important}');
    expect(e).toContain('grid-template-areas:"satir satir satir satir" "gorsel bilgi bilgi bilgi" "gorsel fiyat hemen sepet";padding:16px 40px');
    expect(e).toContain('.sticky-add-to-cart__hemen,.sticky-add-to-cart__button{min-width:176px}');
  });

  it('yama.py bayt bayt üretir; ikinci uygulamayı, kayan çapayı ve bozuk parantezi reddeder', () => {
    expect(md5(py('sys.stdout.write(yama.uygula(yama.OVR, sys.stdin.read()))', o))).toBe(md5(s));
    expect(() => py('yama.uygula(yama.OVR, sys.stdin.read())', s)).toThrow(/zaten uygulanmış/);
    expect(() => py('yama.uygula(yama.OVR, sys.stdin.read())', o.replace('column-gap:8px}\n  ' + B + ' .sticky-add-to-cart__image{display:none}', 'column-gap:4px}\n  ' + B + ' .sticky-add-to-cart__image{display:none}'))).toThrow(/çapa 0 kez/);
    expect(() => py('yama.CIFTLER[yama.OVR][0] = (yama.CAPA, yama.CAPA + yama.EK + "x{"); yama.uygula(yama.OVR, sys.stdin.read())', o)).toThrow(/parantez dengesi/);
  });
});
