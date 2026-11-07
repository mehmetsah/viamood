/** #995986 · ayse:863 KALEM 2 — Hemen al SOL + Sepete ekle SAĞ (aynı çift), WhatsApp dolgulu. Canlıya istek yok; paket ölçülür. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..', 'tema-yamalari', '995986-k2-dugmeler');
const oku = (y: string) => readFileSync(join(KOK, y), 'utf8');
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
const py = (kod: string, girdi: string) => execFileSync('python3', ['-I', '-B', '-c', 'import sys; sys.path.insert(0, sys.argv[1]); import yama\n' + kod, KOK], { input: girdi, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const D = { bb: 'blocks__buy-buttons.liquid', se: 'snippets__via-satinal-ek.liquid', css: 'assets__via-product-overrides.css' };
const sat = (s: string) => s.split('\n');

describe('#995986 K2 düğmeler', () => {
  const m = JSON.parse(oku('md5.json'));
  it('md5 kütüğü üç dosyada tutuyor', () => {
    for (const [k, f] of [['blocks/buy-buttons.liquid', D.bb], ['snippets/via-satinal-ek.liquid', D.se], ['assets/via-product-overrides.css', D.css]] as const) {
      expect(md5(oku('ONCESI/' + f))).toBe(m[k].once); expect(md5(oku('SONRASI/' + f))).toBe(m[k].sonra);
    }
  });
  it('buy-buttons: Hemen al çağrısı Sepete ekle bloğunun ÖNÜNDE ve aynı .via-al-cifti içinde; standart çağrı hemen_ayri: true', () => {
    const s = oku('SONRASI/' + D.bb);
    const cift = s.indexOf('<div class="via-al-cifti">'), hemen = s.indexOf("kip: 'hemen'"), atc = s.indexOf("type: 'add-to-cart'"), kapa = s.indexOf('</div>', atc);
    expect(cift).toBeGreaterThan(0); expect(hemen).toBeGreaterThan(cift); expect(atc).toBeGreaterThan(hemen); expect(kapa).toBeGreaterThan(atc);
    expect(s.slice(atc, kapa)).not.toContain('<div');
    expect((s.match(/render 'via-satinal-ek'/g) || []).length).toBe(2);
    expect(s).toContain("form_id: product_form_id, hemen_ayri: true -%}");
  });
  it('via-satinal-ek: kip hemen yalnız Hemen al basar (WhatsApp yok); standart kip hemen_ayri ile Hemen al basmaz; veri adası yalnız kip ""', () => {
    const s = oku('SONRASI/' + D.se);
    const h = s.slice(s.indexOf("{%- if kip == 'hemen' -%}"), s.indexOf('{%- elsif dugme_ciz -%}'));
    expect(h).toContain('data-via-hemen-al'); expect(h).toContain('data-via-satinal'); expect(h).toContain('data-form-id');
    expect(h).not.toContain('via-wa-siparis');
    expect(h).toContain('{%- if dugme_ciz and hemen_var -%}');
    expect(s).toContain('{%- if hemen_var and hemen_ayri != true -%}');
    expect(s).toContain("{%- if kip == '' -%}\n    <script type=\"application/json\" data-via-wa-urun");
    expect(s).not.toContain("{%- if kip != 'vqb' -%}\n    <script type=\"application/json\"");
    expect((s.match(/data-via-hemen-al>Hemen al</g) || []).length).toBe(2);
  });
  it('CSS: yalnız EKLEME; WhatsApp #25D366 dolgu + --empire-ink-soft yazı; yeni renk yok', () => {
    const o = oku('ONCESI/' + D.css), s = oku('SONRASI/' + D.css);
    let j = 0; for (const x of sat(s)) if (j < sat(o).length && x === sat(o)[j]) j++;
    expect(j).toBe(sat(o).length);
    const ek = s.slice(s.indexOf('/* ── #995986'), s.indexOf('.via-wa-siparis:hover{background:#25D366'));
    expect(ek).toContain('.via-wa-siparis{background:#25D366;border-color:#25D366;color:var(--empire-ink-soft)}');
    const govde = (ek.match(/\{[^}]*\}/g) || []).join(' ');
    expect(new Set((govde.match(/#[0-9a-fA-F]{3,6}\b/g) || []).map((x) => x.toUpperCase()))).toEqual(new Set(['#25D366']));
    expect(ek).toContain('.product-form-buttons .via-al-cifti{display:flex;flex:1 1 260px;gap:12px;min-width:0}');
    expect(ek).toContain('.product-form-buttons .via-al-cifti .add-to-cart-button{padding-left:8px!important;padding-right:8px!important}');
    expect(ek).toContain('.via-satinal-ek--hemen .via-hemen-al{padding:0 8px}');
  });
  it('yama.py üç dosyada bayt bayt üretir; ikinci uygulamayı reddeder; if/endif dengesi korunur', () => {
    for (const [k, f] of [['BB', D.bb], ['SE', D.se], ['CSS', D.css]] as const) {
      expect(md5(py(`sys.stdout.write(yama.uygula(yama.${k}, sys.stdin.read()))`, oku('ONCESI/' + f)))).toBe(md5(oku('SONRASI/' + f)));
      expect(() => py(`yama.uygula(yama.${k}, sys.stdin.read())`, oku('SONRASI/' + f))).toThrow(/zaten uygulanmış/);
    }
    expect(() => py('yama.CIFTLER[yama.SE][1] = (yama.SE_DUGME, yama.SE_DUGME_YENI.replace("{%- elsif dugme_ciz -%}", "{%- endif -%}{%- if dugme_ciz -%}{%- if true -%}")); yama.uygula(yama.SE, sys.stdin.read())', oku('ONCESI/' + D.se))).toThrow(/dengesi/);
  });
});
