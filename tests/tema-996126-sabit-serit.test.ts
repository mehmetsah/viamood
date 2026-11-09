/** #996126 · ayse:888 — ürün sayfası sabit satın alma şeridi: ad TAM · görsel 52 → 65 · şerit yatay alanı kaplar. Canlıya istek yok; paket ölçülür. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..', 'tema-yamalari', '996126-sabit-serit');
const oku = (y: string) => readFileSync(join(KOK, y), 'utf8');
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
const py = (kod: string, girdi: string) => execFileSync('python3', ['-I', '-B', '-c', 'import sys; sys.path.insert(0, sys.argv[1]); import yama\n' + kod, KOK], { input: girdi, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const D = { ovr: 'assets__via-product-overrides.css', mob: 'assets__via-mobile-app.css' };
const yorumsuz = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
// Şerit bloğu: «sabit çubuk: ızgara» başlığından bir sonraki «/* ===» bölüm başlığına kadar.
const blok = (s: string) => s.slice(s.indexOf('/* sabit çubuk: ızgara'), s.indexOf('/* ====', s.indexOf('/* sabit çubuk: ızgara')));
const medya = (s: string, sorgu: string) => { const i = s.indexOf('@media ' + sorgu + '{'); if (i < 0) return ''; return s.slice(i, s.indexOf('\n}\n', i) + 2); };
const B = 'sticky-add-to-cart[data-variant-available="true"]';

describe('#996126 sabit satın alma şeridi', () => {
  const m = JSON.parse(oku('md5.json'));
  const o = oku('ONCESI/' + D.ovr), s = oku('SONRASI/' + D.ovr), ob = blok(o), sb = blok(s);

  it('md5 kütüğü iki dosyada tutuyor', () => {
    for (const [k, f] of [['assets/via-product-overrides.css', D.ovr], ['assets/via-mobile-app.css', D.mob]] as const) {
      expect(md5(oku('ONCESI/' + f))).toBe(m[k].once); expect(md5(oku('SONRASI/' + f))).toBe(m[k].sonra);
    }
  });

  it('ad kesilmez: tema nowrap/ellipsis ve ≤389 display:none güçlü seçiciyle ezilir', () => {
    expect(yorumsuz(sb)).toContain(B + ' .sticky-add-to-cart__title{display:block;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:break-word}');
    expect(yorumsuz(sb)).not.toMatch(/ellipsis|nowrap[^}]*__title|__title[^}]*nowrap/);
    expect(yorumsuz(ob)).not.toContain('.sticky-add-to-cart__title{');
  });

  it('görsel 52 → 65 (×1,25): kutu ve ızgara sütunu her kırılımda 65', () => {
    expect(65).toBe(52 * 1.25);
    expect(yorumsuz(sb)).toContain(B + ' .sticky-add-to-cart__image{width:65px;height:65px}');
    expect(yorumsuz(ob)).toContain('grid-template-columns:52px minmax(0,1fr) auto auto');
    expect(yorumsuz(sb)).toContain('grid-template-columns:65px minmax(0,1fr) auto auto');
    expect(medya(sb, '(max-width:749px)')).toContain('grid-template-columns:65px calc(50% - 83px) minmax(0,1fr)');
    expect(yorumsuz(sb)).not.toMatch(/grid-template-columns:52px/);
    expect(yorumsuz(sb)).not.toMatch(/__image\{display:none\}/);
  });

  it('masaüstü: genişlik sayfa ızgarası (en çok 1440) eksi iki yanda #wa-fab payı; 750–1023 ad kendi sırasında', () => {
    expect(192).toBe(2 * (20 + 60 + 16));
    expect(medya(sb, '(min-width:750px)')).toContain(B + ' .sticky-add-to-cart__bar{width:min(1440px,calc(100% - 192px));padding:16px 32px}');
    const tablet = medya(sb, '(min-width:750px) and (max-width:1023px)');
    expect(tablet).toContain('"gorsel bilgi bilgi bilgi" "gorsel fiyat hemen sepet"');
    expect(tablet).toContain('padding:16px 40px');
    expect(medya(sb, '(min-width:1024px)')).toContain('.sticky-add-to-cart__hemen,.sticky-add-to-cart__button{min-width:176px}');
  });

  it('mobil: üç sıra, Hemen al SOL · Sepete ekle SAĞ yarı yarıya, 52px (≥44), Sepete ekle yazısı görünür', () => {
    const mb = medya(sb, '(max-width:749px)');
    expect(mb).toContain('grid-template-areas:"satir satir satir" "gorsel bilgi bilgi" "gorsel fiyat fiyat" "hemen hemen sepet"');
    expect(mb).toContain(B + ' .sticky-add-to-cart__button{width:auto;margin-top:12px}');
    expect(mb).toContain(B + ' .sticky-add-to-cart__bar .add-to-cart-text__content{display:inline}');
    expect(yorumsuz(sb)).toContain('.sticky-add-to-cart__hemen{grid-area:hemen;width:auto;height:52px;padding:0 28px}');
    expect(yorumsuz(sb)).not.toContain('@media (max-width:359px)');
  });

  it('kapsam: şerit bloğu dışında tek bayt değişmez; yeni renk yok; indirim öncesi fiyat kararı aynen', () => {
    expect(o.slice(0, o.indexOf(ob))).toBe(s.slice(0, s.indexOf(sb)));
    expect(o.slice(o.indexOf(ob) + ob.length)).toBe(s.slice(s.indexOf(sb) + sb.length));
    const renk = (x: string) => new Set(yorumsuz(x).match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) || []);
    expect(renk(sb)).toEqual(renk(ob));
    // Bloktaki HER kural yalnız şeridi hedefler (seçicide sticky-add-to-cart) — sayfanın geri kalanına sızan seçici yok.
    const secici = (yorumsuz(sb).match(/(^|[;}\n])\s*([^{}@;]+)\{/g) || []).map((x) => x.replace(/^[;}\n\s]+/, '').slice(0, -1).trim()).filter(Boolean);
    expect(secici.length).toBeGreaterThan(15);
    for (const x of secici) for (const parca of x.split(',')) expect(parca).toContain('sticky-add-to-cart');
    expect(sb).toContain('.sticky-add-to-cart__price .compare-at-price{display:none}');
    expect(sb).toContain('KARAR (Ayşe RET md.3');
  });

  it('WhatsApp FAB: yalnız ≤749 şerit kuralının payı 200 → FAB_PAY; dosyanın geri kalanı aynen', () => {
    const mo = oku('ONCESI/' + D.mob), ms = oku('SONRASI/' + D.mob);
    const pay = Number(py('sys.stdout.write(str(yama.FAB_PAY))', ''));
    expect(pay).toBe(288);
    expect(mo).toContain('bottom: calc(200px + env(safe-area-inset-bottom, 0px)) !important;');
    expect(ms).not.toContain('calc(200px + env(safe-area-inset-bottom');
    expect(ms).toContain(`body:has(.sticky-add-to-cart__bar[data-stuck="true"]) #wa-fab {\n    bottom: calc(${pay}px + env(safe-area-inset-bottom, 0px)) !important;`);
    expect(yorumsuz(ms)).toBe(yorumsuz(mo).replace('calc(200px + env(safe-area-inset-bottom, 0px))', `calc(${pay}px + env(safe-area-inset-bottom, 0px))`));
  });

  it('yama.py iki dosyayı bayt bayt üretir; ikinci uygulamayı ve kayan çapayı reddeder', () => {
    for (const [k, f] of [['OVR', D.ovr], ['MOB', D.mob]] as const) {
      expect(md5(py(`sys.stdout.write(yama.uygula(yama.${k}, sys.stdin.read()))`, oku('ONCESI/' + f)))).toBe(md5(oku('SONRASI/' + f)));
      expect(() => py(`yama.uygula(yama.${k}, sys.stdin.read())`, oku('SONRASI/' + f))).toThrow(/zaten uygulanmış/);
    }
    expect(() => py('yama.uygula(yama.OVR, sys.stdin.read())', o.replace('column-gap:16px;row-gap:0;align-items:center}', 'column-gap:16px;row-gap:0;align-items:start}'))).toThrow(/çapa 0 kez/);
    expect(() => py('yama.CIFTLER[yama.OVR][1] = (yama.CSS_B, yama.CSS_B_YENI + "x{"); yama.uygula(yama.OVR, sys.stdin.read())', o)).toThrow(/parantez dengesi/);
  });
});
