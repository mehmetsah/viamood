/**
 * #994771 — A/B ölçüm: AYNI sayfa yüklemesinde (A) canlı hâl, sonra sim.css body sonuna
 * enjekte edilip (B) yamalı hâl ölçülür. Tek değişken yamanın kendisidir.
 * Ölçütler #994753 nefes.mjs ile aynı (8 boşluk özelliği, via-* sınıflaması, lh<1.3,
 * tıklanabilir dikey <6px, yazı <11px, yatay taşma) + REGRESYON NEGATİFİ:
 *   - tipografi/renk imzası (font-family/size/weight/line-height/color/background/letter-spacing)
 *     A ve B'de öğe öğe karşılaştırılır — fark 0 olmalı
 *   - DOM öğe sayısı A=B olmalı
 *   - boyutu değişen öğeler listelenir (beklenen: yalnız dokunulan öğeler + ataları)
 * Kullanım: node ab.mjs <pc|mobil> <url> <cikti.json> <sim.css> [ekran-oneki]
 * SALT ÖLÇÜM — canlıya yazmaz.
 */
import pw from '/Users/mehmetsah/kod-viamood/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pw;
const [, , kip, URL, CIKTI, SIM, EKRAN] = process.argv;
const MOBIL = kip === 'mobil';
const b = await chromium.launch({ executablePath: '/Users/mehmetsah/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const ctx = await b.newContext({ viewport: MOBIL ? { width: 430, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: MOBIL ? 2 : 1, isMobile: MOBIL, hasTouch: MOBIL,
  userAgent: MOBIL ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
const p = await ctx.newPage();
const hatalar = [];
p.on('pageerror', e => hatalar.push(String(e).slice(0, 160)));
await p.goto(URL + (URL.includes('?') ? '&' : '?') + 'cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForLoadState('load', { timeout: 60000 }).catch(() => console.error('uyari: load gelmedi'));
await p.waitForTimeout(4000);
// sayaç her saniye değişir => metin imzası değil, stil imzası alınır; animasyon/geçiş dondurulur
await p.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;transition:none!important}' });

const olc = () => p.evaluate(() => {
  const px = s => parseFloat(s) || 0;
  const BIZIM = /^(via-|vbk-|vks-|vco-|vuy-|vkr-|vps-|vl-|vmh-|vco_)/;
  const sinifla = (el) => {
    const kendi = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean);
    if (kendi.some(c => BIZIM.test(c))) return 'bizim';
    const ata = el.closest('[class*="via-"],[class*="vbk-"],[class*="vks-"],[class*="vco-"],[class*="vuy-"],[class*="vkr"],[class*="vps-"]');
    if (ata && ata !== el) return 'bizim-kapsayici';
    return 'tema';
  };
  const o = { tarandi: 0, sinif: { bizim: 0, 'bizim-kapsayici': 0, tema: 0 }, lh: 0, tik: 0, fs: 0, kalan: [], imza: [], kutu: [] };
  const seen = new Set();
  let i = 0;
  for (const el of document.querySelectorAll('main *, [class*=product] *')) {
    if (seen.has(el)) continue; seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    o.tarandi++;
    const rect = el.getBoundingClientRect();
    const sec = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
    o.imza.push(sec + '|' + [cs.fontFamily, cs.fontSize, cs.fontWeight, cs.lineHeight, cs.color, cs.backgroundColor, cs.letterSpacing, cs.textTransform, cs.borderTopWidth, cs.borderRadius].join(';'));
    o.kutu.push([sec, +rect.width.toFixed(1), +rect.height.toFixed(1)]);
    const kendiMetin = [...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim());
    if (kendiMetin && (el.textContent || '').trim()) {
      const f = px(cs.fontSize); const lh = cs.lineHeight === 'normal' ? f * 1.2 : px(cs.lineHeight);
      if (lh / f < 1.3) o.lh++;
      if (f < 11) o.fs++;
    }
    if (el.matches('a,button,[role=button],summary,label') && rect.height > 2 && rect.width > 2 && (px(cs.paddingTop) < 6 || px(cs.paddingBottom) < 6)) o.tik++;
    const sf = sinifla(el);
    for (const prop of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) {
      const v = px(cs[prop]);
      if (v > 0 && Math.abs(v % 4) > 0.01 && Math.abs(4 - (v % 4)) > 0.01) { o.sinif[sf]++; o.kalan.push(sf + ' ' + sec + ' ' + prop + '=' + +v.toFixed(2)); }
    }
    i++;
  }
  o.tasma = document.documentElement.scrollWidth + '/' + document.documentElement.clientWidth;
  o.sayfaYuk = document.documentElement.scrollHeight;
  return o;
});
const teyitAl = () => p.evaluate(() => {
  const g = (s, pr) => { const e = document.querySelector(s); return e ? pr.map(x => getComputedStyle(e)[x]).join(' ') : 'YOK'; };
  return {
    atc: g('button.button.add-to-cart-button:not(.sticky-add-to-cart__button)', ['paddingTop', 'paddingBottom', 'height']),
    sticky: g('button.sticky-add-to-cart__button', ['paddingTop', 'paddingBottom']),
    ok: g('button.slideshow-control', ['paddingTop', 'paddingBottom']),
    added: g('.add-to-cart__added', ['rowGap']), odeme: g('form.payment-terms', ['paddingTop']),
    vergi: g('.tax-note', ['marginTop', 'marginBottom']), adet: g('.quantity-selector-wrapper', ['rowGap']),
    sku: g('.sku-line', ['columnGap']), vks: g('.vks', ['paddingTop', 'paddingLeft', 'rowGap']), sayac: g('.vks__sayac', ['paddingTop', 'paddingLeft']),
    rozet: g('.group-block-content.layout-panel-flex--row[style*="--gap"]', ['columnGap']), detayUst: g('.product-details > .group-block.spacing-style', ['paddingTop']),
    alim: g('.product-form-buttons', ['marginTop', 'rowGap']), vendor: g('.resource-card__vendor', ['marginBottom']),
    psBaslik: g('#predictive-search-products .predictive-search-results__title', ['marginTop']), psListe: g('.predictive-search-results__list', ['paddingTop']),
  };
});
const A = await olc();
const teyitA = await teyitAl();
if (EKRAN) await p.screenshot({ path: `${EKRAN}-A.png`, fullPage: true });
const sim = fs.readFileSync(SIM, 'utf8');
await p.evaluate((css) => { const st = document.createElement('style'); st.id = 'g994771-sim'; st.textContent = css; document.body.appendChild(st); }, sim);
await p.waitForTimeout(900);
const B = await olc();
const teyitB = await teyitAl();
if (EKRAN) await p.screenshot({ path: `${EKRAN}-B.png`, fullPage: true });

const imzaFark = [];
for (let k = 0; k < Math.max(A.imza.length, B.imza.length); k++) if (A.imza[k] !== B.imza[k]) imzaFark.push({ A: A.imza[k], B: B.imza[k] });
const kutuFark = [];
for (let k = 0; k < Math.min(A.kutu.length, B.kutu.length); k++) {
  const [s, w1, h1] = A.kutu[k]; const [, w2, h2] = B.kutu[k];
  if (Math.abs(w1 - w2) > 0.05 || Math.abs(h1 - h2) > 0.05) kutuFark.push(`${s} ${w1}x${h1} -> ${w2}x${h2}`);
}
const ozet = (o) => ({ tarandi: o.tarandi, sinif: o.sinif, lh: o.lh, tik: o.tik, fs: o.fs, tasma: o.tasma, sayfaYuk: o.sayfaYuk });
const out = { viewport: MOBIL ? 430 : 1440, url: URL, A: ozet(A), B: ozet(B), teyitA, teyitB, kalanB: B.kalan, imzaFarkSayisi: imzaFark.length, imzaFark: imzaFark.slice(0, 20), kutuFarkSayisi: kutuFark.length, kutuFark, jsHata: hatalar };
fs.writeFileSync(CIKTI, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ vp: out.viewport, A: out.A, B: out.B, imzaFark: out.imzaFarkSayisi, kutuFark: out.kutuFarkSayisi, js: hatalar.length, kalanB: B.kalan }, null, 0));
await b.close();
