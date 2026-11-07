/**
 * #995986 · ayse:863 KALEM 3 — kazanç rozeti ürün adının üstünde; tutar = compare_at − price; indirim yoksa HİÇ basılmaz.
 * Blok dosyasının kendi Liquid'i küçük bir alt küme yorumlayıcıyla KOŞTURULUR (assign · minus · if > · çıktı).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..', 'tema-yamalari', '995986-k3-kazanc-rozeti');
const oku = (y: string) => readFileSync(join(KOK, y), 'utf8');
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
const js = (s: string) => JSON.parse(s.slice(s.indexOf('{')));
const py = (kod: string, girdi: string) => execFileSync('python3', ['-I', '-B', '-c', 'import sys; sys.path.insert(0, sys.argv[1]); import yama\n' + kod, KOK], { input: girdi, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const BLOK = oku('YENI/blocks__via-kazanc.liquid');

type Ctx = Record<string, unknown>;
const para = (kurus: number) => { const t = kurus / 100; return (Number.isInteger(t) ? String(t) : t.toFixed(2).replace('.', ',')) + 'TL'; };
function deger(ifade: string, c: Ctx): unknown {
  const t = ifade.trim();
  if (/^-?\d+$/.test(t)) return Number(t);
  return t.split('.').reduce<unknown>((x, k) => (x == null ? undefined : (x as Record<string, unknown>)[k]), c);
}
function zincir(ifade: string, c: Ctx): unknown {
  const [bas, ...f] = ifade.split('|').map((x) => x.trim());
  let v = deger(bas!, c);
  for (const s of f) {
    const [ad, arg] = s.split(':').map((x) => x.trim());
    if (ad === 'minus') v = Number(v) - Number(deger(arg!, c));
    else if (ad === 'money_without_trailing_zeros') v = para(Number(v));
    else throw new Error('filtre yok: ' + ad);
  }
  return v;
}
const kosul = (k: string, c: Ctx) => { const m = k.match(/^(.+?)\s*>\s*(.+)$/); if (!m) throw new Error('koşul: ' + k); const a = deger(m[1]!, c), b = deger(m[2]!, c); return a != null && b != null && Number(a) > Number(b); };
/** Bloğun yorum/şema/stil/betik DIŞINDAKİ görünür HTML çıktısı. */
function koştur(urun: { variants: { size: number }; secili: { price: number; compare_at_price: number | null } }): string {
  const c: Ctx = { closest: { product: { ...urun, selected_or_first_available_variant: urun.secili } } };
  let g = BLOK.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/\{%\s*stylesheet\s*%\}[\s\S]*?\{%\s*endstylesheet\s*%\}/g, '').replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/g, '');
  const lq = g.match(/\{%-?\s*liquid([\s\S]*?)-?%\}/)!; g = g.replace(lq[0], '');
  const satirlar = lq[1]!.split('\n').map((x) => x.trim()).filter(Boolean); let atla = 0;
  for (const s of satirlar) {
    if (s.startsWith('if ')) { if (atla || !kosul(s.slice(3), c)) atla++; continue; }
    if (s === 'endif') { if (atla) atla--; continue; }
    if (atla) continue;
    const m = s.match(/^assign (\w+) = (.+)$/); if (!m) throw new Error('satır: ' + s);
    c[m[1]!] = zincir(m[2]!, c);
  }
  g = g.replace(/\{%-?\s*if (.+?)\s*-?%\}([\s\S]*?)\{%-?\s*endif\s*-?%\}/g, (_x, k: string, ic: string) => (kosul(k, c) ? ic : ''));
  g = g.replace(/\{\{\s*block\.shopify_attributes\s*\}\}/g, '').replace(/\{\{(.+?)\}\}/g, (_x, e: string) => String(zincir(e, c)));
  return g.replace(/<script>[\s\S]*?<\/script>/g, '<script/>').trim();
}

describe('#995986 K3 kazanç rozeti', () => {
  const m = JSON.parse(oku('md5.json'));
  it('md5: yeni blok + iki şablon tutuyor; product.json ÖNCESİ = K1 SONRASI', () => {
    expect(md5(BLOK)).toBe(m['blocks/via-kazanc.liquid'].sonra); expect(m['blocks/via-kazanc.liquid'].once).toBeNull();
    for (const f of ['templates__product.json', 'templates__product.cok-al.json']) {
      const k = f.replace('__', '/'); expect(md5(oku('ONCESI/' + f))).toBe(m[k].once); expect(md5(oku('SONRASI/' + f))).toBe(m[k].sonra);
    }
    expect(m['templates/product.json'].once).toBe(md5(readFileSync(join(KOK, '..', '995986-k1-kargo-bari', 'SONRASI', 'templates__product.json'), 'utf8')));
  });
  it('indirimli ürün (750 → 500): «Kazancınız 250TL» tutarı HESAPLANIR', () => {
    expect(koştur({ variants: { size: 1 }, secili: { price: 50000, compare_at_price: 75000 } })).toMatch(/^<p class="via-kazanc" data-via-kazanc >Kazancınız 250TL<\/p>$/);
    expect(koştur({ variants: { size: 1 }, secili: { price: 95000, compare_at_price: 110000 } })).toContain('Kazancınız 150TL');
    expect(koştur({ variants: { size: 1 }, secili: { price: 19990, compare_at_price: 25000 } })).toContain('Kazancınız 50,10TL');
  });
  it('★ NEGATİF (md.52): indirim yoksa, eşitse ya da ters ise HİÇBİR ŞEY basılmaz (sıfır/boş rozet yok)', () => {
    expect(koştur({ variants: { size: 1 }, secili: { price: 45000, compare_at_price: null } })).toBe('');
    expect(koştur({ variants: { size: 1 }, secili: { price: 45000, compare_at_price: 45000 } })).toBe('');
    expect(koştur({ variants: { size: 1 }, secili: { price: 45000, compare_at_price: 30000 } })).toBe('');
  });
  it('çok varyantlı üründe yalnız variant:update betiği basılır (rozet yoksa görünür öğe yok); tek varyantta betik yok', () => {
    expect(koştur({ variants: { size: 6 }, secili: { price: 45000, compare_at_price: null } })).toBe('<script/>');
    expect(BLOK).toMatch(/addEventListener\('variant:update'/);
    expect(BLOK).not.toMatch(/toLocaleString|formatMoney|Intl\.NumberFormat/);
  });
  it('görsel dil .vkr__rozet ile aynı; yeni renk yok', () => {
    const st = BLOK.slice(BLOK.indexOf('{% stylesheet %}'), BLOK.indexOf('{% endstylesheet %}'));
    expect(st).toContain('background: #1c6b45;'); expect(st).toContain('color: #fff;'); expect(st).toContain('font-size: 11px;');
    expect(new Set((st.match(/#[0-9a-fA-F]{3,6}\b/g) || []).map((x) => x.toLowerCase()))).toEqual(new Set(['#1c6b45', '#fff']));
  });
  it('şablonlar: via_kazanc bloğu eklendi ve block_order BAŞINDA (başlıktan önce); başka alan değişmedi', () => {
    for (const f of ['templates__product.json', 'templates__product.cok-al.json']) {
      const o = js(oku('ONCESI/' + f)).sections.main.blocks['product-details'], s = js(oku('SONRASI/' + f)).sections.main.blocks['product-details'];
      expect(s.block_order).toEqual(['via_kazanc', ...o.block_order]); expect(s.block_order[1]).toBe('text_GnyQiN');
      expect(s.blocks.via_kazanc).toEqual({ type: 'via-kazanc', settings: {} });
    }
  });
  it('yama.py iki şablonda bayt bayt üretir; ikinci uygulamayı ve ikinci JSON alanını reddeder', () => {
    for (const [k, f] of [['TPL', 'templates__product.json'], ['COK', 'templates__product.cok-al.json']] as const) {
      expect(md5(py(`sys.stdout.write(yama.uygula(yama.${k}, sys.stdin.read()))`, oku('ONCESI/' + f)))).toBe(md5(oku('SONRASI/' + f)));
      expect(() => py(`yama.uygula(yama.${k}, sys.stdin.read())`, oku('SONRASI/' + f))).toThrow(/çapa|zaten var/);
    }
    expect(() => py('yama.TANIM_YENI = yama.TANIM_YENI.replace(\'"settings": {}\', \'"settings": {}, "disabled": true\'); yama.uygula(yama.TPL, sys.stdin.read())', oku('ONCESI/templates__product.json'))).toThrow(/tanımı beklenenden farklı/);
  });
});
