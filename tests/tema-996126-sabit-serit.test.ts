/** #996126 · ayse:888 — ürün sayfası sabit satın alma şeridi, YALNIZ MASAÜSTÜ (≥750; Yunus 9 Kas 11:20 «Sadece Pc için»).
 *  Bu tur: Ayşe RET %96 (10 Kas 12:03) — kapsül yarıçapı sabit (750–1023: 60px [ŞAH kararı; 72'de «Sepete ekle» 7,5 px] ·
 *  ≥1024: 65px). Telefon (≤749) canlıda birebir aynı kalmalı. Canlıya istek yok; paket ölçülür. */
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
const ILK_CANLI = '69d89501771c3eed2f23008efe40044e'; // #996126'dan önceki canlı: telefon bu hâlde kalır
const yorumsuz = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const B = 'sticky-add-to-cart[data-variant-available="true"]';
// #996126 masaüstü bölümü: başlık yorumundan ≥1024 medya bloğunun sonuna kadar.
const bolum = (s: string) => { const i = s.indexOf('/* ── #996126'); const j = s.indexOf('\n}\n', s.indexOf('@media (min-width:1024px){', i)) + 3; return [i, j] as const; };
const ustBloklar = (css: string) => {
  const out: [string, string][] = []; let d = 0, bas = 0, ac = -1;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') { if (d === 0) ac = i; d++; } else if (css[i] === '}') { d--; if (d === 0) { out.push([css.slice(bas, ac).trim(), css.slice(ac + 1, i)]); bas = i + 1; } }
  }
  expect(css.slice(bas).trim()).toBe('');
  return out;
};
// Köşe payı: öğenin şerit kenarlarına uzaklığı (dx, dy), eğri yarıçapı r → r − |(r−dx, r−dy)| (köşe bölgesindeyse).
const pay = (r: number, dx: number, dy: number) => (dx < r && dy < r ? r - Math.hypot(r - dx, r - dy) : Math.min(dx, dy));
const yaricap = (blok: string) => Number((blok.match(/__bar\{[^}]*border-radius:(\d+)px/) || [])[1]);

describe('#996126 sabit şerit — yalnız masaüstü + kapsül yarıçapı', () => {
  const m = JSON.parse(oku('md5.json'));
  const o = oku('ONCESI/' + F), s = oku('SONRASI/' + F);
  const [si, sj] = bolum(s), [oi, oj] = bolum(o); const sb = s.slice(si, sj);
  const medya = (sorgu: string) => { const i = sb.indexOf('@media ' + sorgu + '{'); return i < 0 ? '' : sb.slice(i, sb.indexOf('\n}\n', i) + 2); };

  it('paket tek dosya; ONCESI = 10 Kas 11:11 canlısı (2def0fa1)', () => {
    expect(Object.keys(m)).toEqual(['assets/via-product-overrides.css']);
    expect(md5(o)).toBe(m['assets/via-product-overrides.css'].once); expect(md5(s)).toBe(m['assets/via-product-overrides.css'].sonra);
    expect(m['assets/via-product-overrides.css'].once).toBe('2def0fa18e91166e67423b70096904d7');
    expect(readdirSync(join(KOK, 'ONCESI'))).toEqual([F]); expect(readdirSync(join(KOK, 'SONRASI'))).toEqual([F]); expect(existsSync(join(KOK, 'YENI'))).toBe(false);
    expect(py('sys.stdout.write(",".join(yama.SIRA))', '')).toBe('assets/via-product-overrides.css');
  });

  it('telefon aynı: #996126 bölümü çıkarılınca SONRASI = ilk canlı (69d89501), bayt bayt', () => {
    expect(si).toBeGreaterThan(0); expect(oi).toBeGreaterThan(0);
    expect(md5(s.slice(0, si) + s.slice(sj))).toBe(ILK_CANLI);
    expect(md5(o.slice(0, oi) + o.slice(oj))).toBe(ILK_CANLI);
  });

  it('bölümdeki HER kural min-width ≥750 medya bloğunda, yalnız şeridi hedefliyor; yeni renk yok', () => {
    const bloklar = ustBloklar(yorumsuz(sb));
    expect(bloklar.map((b) => b[0])).toEqual(['@media (min-width:750px)', '@media (min-width:750px) and (max-width:1023px)', '@media (min-width:1024px)']);
    for (const [, govde] of bloklar) for (const [secici, g] of ustBloklar(govde)) {
      for (const x of secici.split(',')) expect(x).toContain('sticky-add-to-cart');
      expect(g).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    }
  });

  it('yarıçap sabit: 750–1023 → 60px, ≥1024 → 65px; 750 ortak bloğunda yarıçap yok', () => {
    expect(yaricap(medya('(min-width:750px) and (max-width:1023px)'))).toBe(60);
    expect(yorumsuz(medya('(min-width:1024px)'))).toContain(B + ' .sticky-add-to-cart__bar{border-radius:65px}');
    expect(medya('(min-width:750px)')).not.toMatch(/border-radius/);
  });

  it('köşe payı ≥11: ölçülen ofsetlerle CSS yarıçapından hesap (72 tablette 7,5 verirdi)', () => {
    // Ölçülen ofsetler (raporlar/996126-kanit/arac/pay.cjs, 10 Kas): tablet iç boşluk 40 yan / 16 alt; kamyon gövdesi
    // svg köşesinden +1,88 / +4,37; svg 17,27 üstte; ≥1024 yan 32, «Sepete ekle» altta 22,5 (tek satır, en dar hâl).
    const rt = yaricap(medya('(min-width:750px) and (max-width:1023px)')), rm = yaricap(medya('(min-width:1024px)'));
    expect(pay(rt, 40, 16)).toBeGreaterThanOrEqual(11);              // tablet «Sepete ekle» kutu köşesi
    expect(pay(rt, 40 + 1.88, 17.27 + 4.37)).toBeGreaterThanOrEqual(11); // tablet kamyon (çizim)
    expect(pay(rm, 32, 22.5)).toBeGreaterThanOrEqual(11);             // ≥1024 «Sepete ekle»
    expect(pay(rm, 32 + 1.88, 17.27 + 4.37)).toBeGreaterThanOrEqual(11); // ≥1024 kamyon (çizim)
    expect(pay(72, 40, 16)).toBeLessThan(11); // Ayşe'nin yazdığı 72'nin neden kullanılmadığının kanıtı
    expect(Math.abs(rm - 130.5 / 2)).toBeLessThan(0.5); // ≥1024 tek satırlı şerit görünümü aynı (65,25 → 65)
  });

  it('masaüstü değerleri korunuyor: genişlik · iç boşluk · görsel 65 · ad tam · tablet düzeni · düğmeler ≥176', () => {
    const e = yorumsuz(sb);
    expect(e).toContain(B + ' .sticky-add-to-cart__bar{grid-template-columns:65px minmax(0,1fr) auto auto;width:min(1440px,calc(100% - 192px));padding:16px 32px}');
    expect(e).toContain(B + ' .sticky-add-to-cart__image{width:65px;height:65px}');
    expect(e).toContain(B + ' .sticky-add-to-cart__title{display:block;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:break-word}');
    expect(e).toContain('grid-template-areas:"satir satir satir satir" "gorsel bilgi bilgi bilgi" "gorsel fiyat hemen sepet";padding:16px 40px');
    expect(e).toContain('.sticky-add-to-cart__hemen,.sticky-add-to-cart__button{min-width:176px}');
  });

  it('yama.py bayt bayt üretir; ikinci uygulamayı, kayan çapayı ve bozuk parantezi reddeder', () => {
    expect(md5(py('sys.stdout.write(yama.uygula(yama.OVR, sys.stdin.read()))', o))).toBe(md5(s));
    expect(() => py('yama.uygula(yama.OVR, sys.stdin.read())', s)).toThrow(/zaten uygulanmış/);
    expect(() => py('yama.uygula(yama.OVR, sys.stdin.read())', o.replace('"gorsel fiyat hemen sepet";padding:16px 40px}', '"gorsel fiyat hemen sepet";padding:16px 44px}'))).toThrow(/çapa 0 kez/);
    expect(() => py('yama.CIFTLER[yama.OVR][1] = (yama.B, yama.B_YENI + "x{"); yama.uygula(yama.OVR, sys.stdin.read())', o)).toThrow(/parantez dengesi/);
  });
});
