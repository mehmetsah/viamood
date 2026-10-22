/**
 * #994888 — ViaMood tema üçlüsü çivileri (m8 yerleşik varyant seçici · m2 politika başlık birliği).
 * Canlıya HİÇBİR istek gitmez: tema-yamalari/994888-tema-uclu altındaki ONCESI/SONRASI/YENI dosyaları ölçülür.
 * m2 snippet'i GERÇEKTEN koşturulur — aşağıdaki küçük Liquid alt kümesi yorumlayıcısı snippet'in
 * `{%- liquid %}` bloğunu satır satır yürütür; snippet metni bozulursa (ör. silme satırı düşerse) çivi ısırır.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..', 'tema-yamalari', '994888-tema-uclu');
const oku = (y: string) => readFileSync(join(KOK, y), 'utf8');
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');

// ---------- minik Liquid alt kümesi (yalnız snippet'in kullandığı yapılar) ----------
type Deger = string | string[] | number | undefined | Record<string, unknown>;
function argBol(s: string, ayirici: string): string[] {
  const out: string[] = []; let tirnak: string | null = null; let cur = '';
  for (const ch of s) {
    if (tirnak) { cur += ch; if (ch === tirnak) tirnak = null; continue; }
    if (ch === "'" || ch === '"') { tirnak = ch; cur += ch; continue; }
    if (ch === ayirici) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur.trim()); return out;
}
function deger(ifade: string, ctx: Record<string, Deger>): Deger {
  const t = ifade.trim();
  if (/^'.*'$/s.test(t) || /^".*"$/s.test(t)) return t.slice(1, -1);
  if (/^-?\d+$/.test(t)) return Number(t);
  if (t === 'blank') return '';
  const m = t.match(/^([a-z_][a-z0-9_]*)((?:\.[a-z_]+|\[\d+\])*)$/i);
  if (!m) throw new Error('ifade anlasilmadi: ' + t);
  let v: unknown = ctx[m[1]];
  for (const p of m[2].match(/\.[a-z_]+|\[\d+\]/gi) ?? []) {
    if (p.startsWith('[')) v = (v as unknown[] | undefined)?.[Number(p.slice(1, -1))];
    else if (p === '.size') v = (v as unknown[] | string | undefined)?.length;
    else v = (v as Record<string, unknown> | undefined)?.[p.slice(1)];
  }
  return v as Deger;
}
function rubySplit(s: string, ayr: string): string[] { const a = s.split(ayr); while (a.length && a[a.length - 1] === '') a.pop(); return a; }
function zincir(ifade: string, ctx: Record<string, Deger>): Deger {
  const [bas, ...filtreler] = argBol(ifade, '|');
  let v = deger(bas, ctx);
  for (const f of filtreler) {
    const i = f.indexOf(':'); const ad = (i < 0 ? f : f.slice(0, i)).trim();
    const args = i < 0 ? [] : argBol(f.slice(i + 1), ',').map(a => deger(a, ctx));
    const s = String(v ?? '');
    switch (ad) {
      case 'split': v = rubySplit(s, String(args[0])); break;
      case 'first': v = (v as string[])[0]; break;
      case 'append': v = s + String(args[0] ?? ''); break;
      case 'strip': v = s.trim(); break;
      case 'remove_first': v = s.replace(String(args[0]), ''); break;
      case 'replace_first': { const a = String(args[0]); const j = s.indexOf(a); v = j < 0 ? s : s.slice(0, j) + String(args[1]) + s.slice(j + a.length); break; }
      default: throw new Error('filtre yok: ' + ad);
    }
  }
  return v;
}
const bosMu = (v: Deger) => v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
function kosul(ifade: string, ctx: Record<string, Deger>): boolean {
  const ve = ifade.split(/\s+and\s+/); if (ve.length > 1) return ve.every(p => kosul(p, ctx));
  let m = ifade.match(/^(.+?)\s+contains\s+(.+)$/); if (m) return String(deger(m[1], ctx) ?? '').includes(String(deger(m[2], ctx)));
  m = ifade.match(/^(.+?)\s*(==|!=)\s*(.+)$/);
  if (m) { const a = deger(m[1], ctx), b = m[3].trim(); const esit = b === 'blank' ? bosMu(a) : a === deger(b, ctx); return m[2] === '==' ? esit : !esit; }
  throw new Error('kosul anlasilmadi: ' + ifade);
}
function liquidKos(satirlar: string[], ctx: Record<string, Deger>): void {
  for (let i = 0; i < satirlar.length; i++) {
    const s = satirlar[i];
    const blokSonu = (ac: RegExp, kapa: RegExp) => { let d = 0; for (let j = i; j < satirlar.length; j++) { if (ac.test(satirlar[j])) d++; if (kapa.test(satirlar[j]) && --d === 0) return j; } throw new Error('blok kapanmadi'); };
    let m: RegExpMatchArray | null;
    if ((m = s.match(/^assign\s+(\w+)\s*=\s*(.+)$/))) { ctx[m[1]] = zincir(m[2], ctx); continue; }
    if ((m = s.match(/^for\s+(\w+)\s+in\s+(\w+)$/))) { const son = blokSonu(/^for\s/, /^endfor$/); const govde = satirlar.slice(i + 1, son); for (const x of (ctx[m[2]] as string[])) { ctx[m[1]] = x; liquidKos(govde, ctx); } i = son; continue; }
    if ((m = s.match(/^if\s+(.+)$/))) { const son = blokSonu(/^if\s/, /^endif$/); const ic = satirlar.slice(i + 1, son); let d = 0, el = -1; ic.forEach((x, k) => { if (/^if\s/.test(x)) d++; if (/^endif$/.test(x)) d--; if (x === 'else' && d === 0 && el < 0) el = k; }); liquidKos(kosul(m[1], ctx) ? (el < 0 ? ic : ic.slice(0, el)) : (el < 0 ? [] : ic.slice(el + 1)), ctx); i = son; continue; }
    throw new Error('satir anlasilmadi: ' + s);
  }
}
function snippetKos(icerik: string, unvan = 'VIA GLOBAL DIŞ TİCARET LİMİTED ŞİRKETİ'): string {
  const src = oku('YENI/snippets__via-politika-baslik.liquid');
  const blok = src.match(/\{%-\s*liquid([\s\S]*?)-%\}/)?.[1];
  if (!blok) throw new Error('liquid blogu yok');
  const ctx: Record<string, Deger> = { icerik, settings: { company_title: unvan } };
  liquidKos(blok.split('\n').map(x => x.trim()).filter(Boolean), ctx);
  expect(src.trim().endsWith('{{ govde }}')).toBe(true);
  return String(ctx.govde);
}
// Canlı /policies/privacy-policy'nin content_for_layout biçimi (22 Eki 2026'da ölçülen kalıp, kısaltılmış)
const POLITIKA = `<div class="shopify-policy__container">
  <div class="shopify-policy__title">
    <h1>Gizlilik politikası</h1>
  </div>
  <div class="shopify-policy__body">
    <div class="rte">
        <div>
  <p>Son Güncelleme: 13 Ekim 2026</p>
  <p>Via Mood, siz müşterilere kişisel bir alışveriş deneyimi sunar.</p>
  <h2>Değişiklikler</h2><p>Güncellenmiş politikayı yayınlar ve "Son Güncelleme" tarihini güncelleriz.</p>
</div></div></div></div>`;

describe('#994888 m2 — politika sayfası başlık birliği (snippet koşturulur)', () => {
  it('göz başlığı başlığın ÜSTÜNDE, tarih satırı hemen ALTINDA, diğer yasal sayfalarla aynı biçimde', () => {
    const h = snippetKos(POLITIKA);
    expect(h).toContain('<div class="shopify-policy__title"><p class="vl-eyebrow">Yasal · Via Mood</p>');
    expect(h).toContain('<h1>Gizlilik politikası</h1><p class="vl-meta">Son güncelleme: Ekim 2026 · VIA GLOBAL DIŞ TİCARET LİMİTED ŞİRKETİ</p>');
    expect(h.indexOf('vl-eyebrow')).toBeLessThan(h.indexOf('<h1>'));
    expect(h.indexOf('vl-meta')).toBeGreaterThan(h.indexOf('</h1>'));
  });
  it('panel içindeki "Son Güncelleme" SATIRI kalkar; hukuki metnin geri kalanı (o ifadeyi anan cümle dahil) aynen kalır', () => {
    const h = snippetKos(POLITIKA);
    expect(h).not.toContain('<p>Son Güncelleme: 13 Ekim 2026</p>');
    expect(h).toContain('"Son Güncelleme" tarihini güncelleriz.');
    expect(h).toContain('<p>Via Mood, siz müşterilere kişisel bir alışveriş deneyimi sunar.</p>');
    expect(h.replace(/<p class="vl-(eyebrow|meta)">[^<]*<\/p>/g, '')).toBe(POLITIKA.replace('  <p>Son Güncelleme: 13 Ekim 2026</p>', '  '));
  });
  it('tarih UYDURULMAZ: politikanın kendi tarihinden türetilir; tarih satırı yoksa yalnız unvan yazılır', () => {
    expect(snippetKos(POLITIKA.replace('13 Ekim 2026', '2 Mart 2027'))).toContain('Son güncelleme: Mart 2027 · VIA');
    const tarihsiz = snippetKos(POLITIKA.replace('  <p>Son Güncelleme: 13 Ekim 2026</p>\n', ''));
    expect(tarihsiz).toContain('<p class="vl-meta">VIA GLOBAL DIŞ TİCARET LİMİTED ŞİRKETİ</p>');
    expect(tarihsiz).not.toMatch(/Mayıs 2026|Son güncelleme:/);
  });
  it('layout yalnız policy sayfasında snippet çağırır, öteki her sayfada content_for_layout AYNEN basılır', () => {
    const once = oku('ONCESI/layout__theme.liquid'), sonra = oku('SONRASI/layout__theme.liquid');
    expect(sonra.match(/\{\{ content_for_layout \}\}/g)?.length).toBe(1);
    expect(sonra).toMatch(/\{% if request\.page_type == 'policy' %\}\s*\{% render 'via-politika-baslik', icerik: content_for_layout %\}\s*\{% else %\}\s*\{\{ content_for_layout \}\}\s*\{% endif %\}/);
    // policy dalı dışında layout bayt bayt aynı
    const bas = sonra.indexOf('      {%- comment -%} #994888');
    const dal = sonra.slice(bas, sonra.indexOf('{% endif %}', bas) + '{% endif %}'.length);
    expect(sonra.replace(dal, '      {{ content_for_layout }}')).toBe(once);
  });
  it('m2 CSS değerleri YENİ TASARIM DEĞİL — via-legal-page .vl-eyebrow/.vl-title/.vl-meta ile birebir (sapma ısırır)', () => {
    const ref = oku('ONCESI/sections__via-legal-page.liquid'), css = oku('YENI/m2-ek.css');
    const renk: Record<string, string> = { 'var(--vl-clay)': '#b66c55', 'var(--vl-muted)': '#5d6458' };
    const blok = (s: string, sec: RegExp) => { const m = s.match(sec); if (!m) throw new Error('blok yok ' + sec); return Object.fromEntries(m[1].split(';').map(x => x.trim()).filter(Boolean).map(x => { const [k, ...v] = x.split(':'); const d = v.join(':').replace('!important', '').trim(); return [k.trim(), renk[d] ?? d]; })); };
    const rEy = blok(ref, /\.vl-eyebrow \{([^}]*)\}/), rTi = blok(ref, /\.vl-title \{([^}]*)\}/), rMe = blok(ref, /\.vl-meta \{([^}]*)\}/);
    const cEy = blok(css, /\.shopify-policy__title \.vl-eyebrow \{([^}]*)\}/), cTi = blok(css, /\.shopify-policy__title\.shopify-policy__title h1 \{([^}]*)\}/), cMe = blok(css, /\.shopify-policy__title \.vl-meta \{([^}]*)\}/);
    expect(cEy).toEqual(rEy);
    for (const k of ['margin', 'font-size']) expect(cTi[k]).toBe(rTi[k]);
    expect(cMe.color).toBe(rMe.color); expect(cMe['font-size']).toBe(rMe['font-size']);
    // referansın 36px alt boşluğu kapta (.shopify-policy__title margin 0 0 36px, #994058) — meta'da 0 olmalı, yoksa çift boşluk
    expect(cMe.margin).toBe('0'); expect(oku('ONCESI/assets__via-product-overrides.css')).toMatch(/\.shopify-policy__title\.shopify-policy__title \{[^}]*margin: 0 0 36px !important;/);
  });
});

describe('#994888 m8 — temanın YERLEŞİK variant-picker bloğu (buttons) ürün şablonunda', () => {
  const pd = (y: string) => JSON.parse(oku(y)).sections.main.blocks['product-details'];
  it('fiyat bloğundan HEMEN sonra, rozet/kargo/sepete-ekle bloklarından ÖNCE; kutucuk (buttons) biçimi', () => {
    const s = pd('SONRASI/templates__product.json');
    const sira: string[] = s.block_order; const i = sira.findIndex(id => s.blocks[id].type === 'variant-picker');
    expect(i).toBeGreaterThan(-1);
    expect(s.blocks[sira[i - 1]].type).toBe('price');
    expect(sira.indexOf('buy_buttons_eYQEYi')).toBeGreaterThan(i);
    expect(sira.filter(id => s.blocks[id].type === 'variant-picker')).toHaveLength(1);
    expect(s.blocks[sira[i]].settings.variant_style).toBe('buttons');
    expect(s.blocks[sira[i]].settings['padding-block-end'] % 4).toBe(0);
  });
  it('başka hiçbir blok değişmedi; çok-al seçici (via-cok-al) bu işe girmedi', () => {
    const o = pd('ONCESI/templates__product.json'), s = pd('SONRASI/templates__product.json');
    expect(s.block_order.filter((id: string) => s.blocks[id].type !== 'variant-picker')).toEqual(o.block_order);
    for (const id of o.block_order) expect(s.blocks[id]).toEqual(o.blocks[id]);
    const basilan = Object.keys(JSON.parse(oku('md5.json')));
    expect(basilan.filter(k => /cok-al|via-cok-al/.test(k))).toEqual([]);
    expect(oku('YENI/m2-ek.css')).not.toMatch(/vqb__/);
  });
  it('yerleşik blok tek varyantlı üründe hiçbir şey çizmez (has_only_default_variant kapısı canlı kaynakta)', () => {
    expect(oku('ONCESI/blocks__variant-picker.liquid')).toContain("render 'variant-main-picker'");
  });
});

describe('#994888 — basılan baytlar = depodaki SONRASI (md5 kütüğü)', () => {
  it('md5.json SONRASI/YENI dosyalarıyla birebir', () => {
    const M = JSON.parse(oku('md5.json')) as Record<string, { once: [number, string] | null; sonra: [number, string] }>;
    for (const [k, v] of Object.entries(M)) {
      const fn = k.replace(/\//g, '__');
      expect(md5(oku('SONRASI/' + fn)), k).toBe(v.sonra[1]);
      if (v.once) expect(md5(oku('ONCESI/' + fn)), k).toBe(v.once[1]);
    }
  });
});
