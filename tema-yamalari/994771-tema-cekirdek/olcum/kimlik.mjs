/**
 * #994771 — TEMA ÇEKİRDEĞİ 4px ızgara ihlallerini TEK TEK kimliklendirir.
 * Tarama kapsamı ve sınıflandırma #994753 nefes.mjs / kimlik.mjs ile BİREBİR aynı
 * (main *, [class*=product] * · 8 boşluk özelliği · via-* önek sınıflaması) —
 * böylece sayı #994753'ün "tema 53 / 67" sütunuyla kıyaslanabilir.
 * Her ihlalin KAZANAN bildirimi CDP CSS.getMatchedStylesForNode ile bulunur
 * (canlıda cssRules CORS'a takılıyor, CDP takılmıyor).
 * SALT ÖLÇÜM — canlıya yazmaz. İsteğe bağlı: argv[4] = enjekte edilecek CSS dosyası (A/B).
 * Kullanım: node kimlik.mjs <pc|mobil> <url> <cikti.json> [enjekte.css] [ekran.png]
 */
import pw from '/Users/mehmetsah/kod-viamood/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pw;
const MOBIL = process.argv[2] === 'mobil';
const URL = process.argv[3];
const CIKTI = process.argv[4];
const ENJ = process.argv[5] && process.argv[5] !== '-' ? fs.readFileSync(process.argv[5], 'utf8') : null;
const EKRAN = process.argv[6];
const b = await chromium.launch({ executablePath: '/Users/mehmetsah/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const ctx = await b.newContext({ viewport: MOBIL ? { width: 430, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: MOBIL, hasTouch: MOBIL,
  userAgent: MOBIL ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
const sayfalar = new Map();
cdp.on('CSS.styleSheetAdded', e => sayfalar.set(e.header.styleSheetId, { url: e.header.sourceURL || '', inline: e.header.isInline, origin: e.header.origin, startLine: e.header.startLine }));
await p.goto(URL + (URL.includes('?') ? '&' : '?') + 'cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForLoadState('load', { timeout: 60000 }).catch(() => console.error('uyari: load gelmedi'));
await p.waitForTimeout(4000);
if (ENJ) {
  await p.evaluate((css) => { const st = document.createElement('style'); st.id = 'g994771'; st.textContent = css; document.body.appendChild(st); }, ENJ);
  await p.waitForTimeout(800);
}

/* 1) Tarama — nefes.mjs ile aynı kapsam + aynı sınıflama; tema ihlallerini işaretle */
const tarama = await p.evaluate(() => {
  const px = s => parseFloat(s) || 0;
  const BIZIM = /^(via-|vbk-|vks-|vco-|vuy-|vkr-|vps-|vl-|vmh-|vco_)/;
  const sinifla = (el) => {
    const kendi = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean);
    if (kendi.some(c => BIZIM.test(c))) return 'bizim';
    const ata = el.closest('[class*="via-"],[class*="vbk-"],[class*="vks-"],[class*="vco-"],[class*="vuy-"],[class*="vkr"],[class*="vps-"]');
    if (ata && ata !== el) return 'bizim-kapsayici';
    return 'tema';
  };
  const yol = (el) => { const q = []; let x = el; while (x && x !== document.body && q.length < 5) { const c = (typeof x.className === 'string' ? x.className : '').trim().split(/\s+/)[0]; q.unshift(x.tagName.toLowerCase() + (c ? '.' + c : '')); x = x.parentElement; } return q.join(' > '); };
  const o = { tarandi: 0, sinif: { bizim: 0, 'bizim-kapsayici': 0, tema: 0 }, lh: 0, tik: 0, fs: 0, liste: [] };
  const seen = new Set(); let n = 0;
  for (const el of document.querySelectorAll('main *, [class*=product] *')) {
    if (seen.has(el)) continue; seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    o.tarandi++;
    const rect = el.getBoundingClientRect();
    const kendiMetin = [...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim());
    if (kendiMetin && (el.textContent || '').trim()) {
      const f = px(cs.fontSize); const lh = cs.lineHeight === 'normal' ? f * 1.2 : px(cs.lineHeight);
      if (lh / f < 1.3) o.lh++;
      if (f < 11) o.fs++;
    }
    if (el.matches('a,button,[role=button],summary,label') && rect.height > 2 && rect.width > 2 && (px(cs.paddingTop) < 6 || px(cs.paddingBottom) < 6)) o.tik++;
    const sf = sinifla(el);
    const ihl = [];
    for (const prop of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) {
      const v = px(cs[prop]);
      if (v > 0 && Math.abs(v % 4) > 0.01 && Math.abs(4 - (v % 4)) > 0.01) { o.sinif[sf]++; ihl.push({ prop, v: +v.toFixed(3) }); }
    }
    if (sf === 'tema' && ihl.length) {
      el.setAttribute('data-g994771', String(n));
      o.liste.push({ i: n++, sec: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
        id: el.id || '', yol: yol(el), ihl, fontSize: cs.fontSize, w: +rect.width.toFixed(1), h: +rect.height.toFixed(1), txt: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) });
    }
  }
  o.tasma = document.documentElement.scrollWidth + '/' + document.documentElement.clientWidth;
  o.sayfaYuk = document.documentElement.scrollHeight;
  return o;
});

/* 2) CDP — her ihlal özelliğinin KAZANAN bildirimi */
const ADAY = {
  paddingTop: ['padding-top', 'padding', 'padding-block', 'padding-block-start'],
  paddingBottom: ['padding-bottom', 'padding', 'padding-block', 'padding-block-end'],
  paddingLeft: ['padding-left', 'padding', 'padding-inline', 'padding-inline-start'],
  paddingRight: ['padding-right', 'padding', 'padding-inline', 'padding-inline-end'],
  marginTop: ['margin-top', 'margin', 'margin-block', 'margin-block-start'],
  marginBottom: ['margin-bottom', 'margin', 'margin-block', 'margin-block-end'],
  rowGap: ['row-gap', 'gap', 'grid-row-gap', 'grid-gap'],
  columnGap: ['column-gap', 'gap', 'grid-column-gap', 'grid-gap'],
};
const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-g994771]' });
const idHarita = new Map();
for (const nid of nodeIds) {
  const { attributes } = await cdp.send('DOM.getAttributes', { nodeId: nid });
  const k = attributes.indexOf('data-g994771'); idHarita.set(Number(attributes[k + 1]), nid);
}
const kaynakAd = (sid) => { const s = sayfalar.get(sid); if (!s) return '?'; if (s.inline || !s.url || s.url === URL) return '(gömülü <style> @satır ' + s.startLine + ')'; return s.url.split('/').pop().split('?')[0]; };
for (const oge of tarama.liste) {
  const nid = idHarita.get(oge.i);
  if (!nid) { oge.cdp = 'node bulunamadi'; continue; }
  const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId: nid });
  // cascade sırası: matchedCSSRules (artan) + inline en son
  const katmanlar = [];
  for (const r of (m.matchedCSSRules || [])) katmanlar.push({ origin: r.rule.origin, kaynak: r.rule.origin === 'user-agent' ? 'TARAYICI VARSAYILANI' : kaynakAd(r.rule.styleSheetId),
    sel: r.rule.selectorList.text, satir: r.rule.style.range ? r.rule.style.range.startLine : null, style: r.rule.style,
    medya: (r.rule.media || []).map(x => x.text).join(' & ') });
  if (m.inlineStyle) katmanlar.push({ origin: 'inline', kaynak: 'style=""', sel: '(style attr)', satir: null, style: m.inlineStyle, medya: '' });
  for (const ih of oge.ihl) {
    const adlar = ADAY[ih.prop];
    let kazanan = null, kazananImp = null;
    for (const k of katmanlar) {
      // önce tam longhand'ı ara (CDP shorthand'ı açıp longhand da verir); yoksa shorthand
      const props = (k.style.cssProperties || []).filter(x => adlar.includes(x.name) && !x.disabled && x.parsedOk !== false);
      if (!props.length) continue;
      const son = props[props.length - 1];
      const tam = (k.style.cssProperties || []).filter(x => x.name === adlar[0] && !x.disabled && x.parsedOk !== false).pop();
      const bil = tam || son;
      // bildirimin "metin" hâli: shorthand'ın kendisi (range'i olan) — düzeltmede hangi metne dokunulacağı
      const metin = props.filter(x => x.range).pop() || bil;
      const kayit = { kaynak: k.kaynak, origin: k.origin, sel: k.sel.slice(0, 160), satir: k.satir, medya: k.medya, bildirim: metin.name + ': ' + metin.value + (metin.important ? ' !important' : ''), longhand: bil.name + ': ' + bil.value, important: !!(bil.important || metin.important) };
      if (kayit.important) kazananImp = kayit; else kazanan = kayit;
    }
    ih.kazanan = kazananImp || kazanan || { kaynak: 'KURAL YOK (miras/varsayılan)', bildirim: '-' };
  }
}
await cdp.detach().catch(() => {});
const out = { viewport: MOBIL ? 430 : 1440, url: URL, enjekte: !!ENJ, tarandi: tarama.tarandi, sinif: tarama.sinif, lh: tarama.lh, tik: tarama.tik, fs: tarama.fs, tasma: tarama.tasma, sayfaYuk: tarama.sayfaYuk,
  temaOgeSayisi: tarama.liste.length, temaIhlal: tarama.liste.reduce((a, x) => a + x.ihl.length, 0), liste: tarama.liste };
fs.writeFileSync(CIKTI, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ viewport: out.viewport, enjekte: out.enjekte, tarandi: out.tarandi, sinif: out.sinif, temaIhlal: out.temaIhlal, temaOge: out.temaOgeSayisi, lh: out.lh, tik: out.tik, fs: out.fs, tasma: out.tasma, sayfaYuk: out.sayfaYuk }));
if (EKRAN) await p.screenshot({ path: EKRAN, fullPage: true });
await b.close();
