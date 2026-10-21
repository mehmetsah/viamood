/**
 * #994771 — GÖZLE BAKMA için ÖNCE|SONRA kırpımları. Aynı sayfa yüklemesinde öğe ekran
 * görüntüsü (A), sim.css enjeksiyonu (B), sonra ikisi yan yana tek PNG'ye birleştirilir.
 * Kullanım: node goruntu.mjs <pc|mobil> <url> <onek> <sim.css|-> <bolge-json>
 *   bolge-json: [{"ad":"detay","sec":".product-details","eylem":"yok|zoom|arama"}]
 * sim.css yerine "-" verilirse yalnız tek hâl (canlı) çekilir (basım sonrası ÖNCE/SONRA için).
 */
import pw from '/Users/mehmetsah/kod-viamood/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pw;
const [, , kip, URL, ONEK, SIM, BOLGE] = process.argv;
const MOBIL = kip === 'mobil';
const bolgeler = JSON.parse(BOLGE);
const b = await chromium.launch({ executablePath: '/Users/mehmetsah/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const ctx = await b.newContext({ viewport: MOBIL ? { width: 430, height: 860 } : { width: 1440, height: 900 }, deviceScaleFactor: 2, isMobile: MOBIL, hasTouch: MOBIL,
  userAgent: MOBIL ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
const p = await ctx.newPage();
await p.goto(URL + (URL.includes('?') ? '&' : '?') + 'cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForLoadState('load', { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(3500);
await p.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;transition:none!important}' });
// sabit sayaç metni: iki karede aynı rakam görünsün diye (yalnız görüntü için, ölçüme girmez)
await p.evaluate(() => { const s = document.querySelector('[data-vks-sayac]'); if (s) { const c = s.cloneNode(true); s.replaceWith(c); } });

const eylem = async (e) => {
  if (e === 'zoom') {
    const t = p.locator('.product-information__media .product-media-container, .product-information__media img').first();
    await t.click({ timeout: 8000 }).catch(err => console.error('zoom tiklanamadi', String(err).slice(0, 80)));
    await p.waitForTimeout(1500);
  } else if (e === 'arama') {
    const ac = p.locator('button.header-actions__action[aria-label="Ara"]:visible').first();
    await ac.click({ timeout: 8000 }).catch(err => console.error('ara tiklanamadi', String(err).slice(0, 80)));
    await p.waitForTimeout(1200);
    const inp = p.locator('input.search-input:visible').first();
    await inp.fill('kutu').catch(err => console.error('yazilamadi', String(err).slice(0, 80)));
    await p.waitForTimeout(4000);
  }
};
// sabit katmanlar (çerez bandı, alt menü, WhatsApp) öğe kırpımını örtmesin — A ve B'de EŞİT uygulanır, ölçüme girmez
const sabitGizle = () => p.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if ((cs.position === 'fixed' || cs.position === 'sticky') && !el.closest('dialog') && !el.closest('predictive-search-component, .predictive-search, [class*=search-modal], .dialog-modal')) el.style.setProperty('visibility', 'hidden', 'important'); } });
const sonuc = [];
for (const bl of bolgeler) {
  await eylem(bl.eylem);
  if (bl.eylem === 'yok') await sabitGizle();
  const loc = bl.sec === 'VIEWPORT' ? { isVisible: async () => true, scrollIntoViewIfNeeded: async () => {}, screenshot: (o) => p.screenshot(o) } : p.locator(bl.sec).first();
  const gorunur = await loc.isVisible().catch(() => false);
  if (!gorunur) { sonuc.push({ ad: bl.ad, durum: 'GORUNMEDI', sec: bl.sec }); continue; }
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(300);
  const yA = `${ONEK}-${bl.ad}-A.png`;
  await loc.screenshot({ path: yA });
  if (SIM !== '-') {
    await p.evaluate((css) => { let st = document.getElementById('g994771-sim'); if (!st) { st = document.createElement('style'); st.id = 'g994771-sim'; document.body.appendChild(st); } st.textContent = css; }, fs.readFileSync(SIM, 'utf8'));
    await p.waitForTimeout(500);
    await loc.screenshot({ path: `${ONEK}-${bl.ad}-B.png` });
    await p.evaluate(() => { const st = document.getElementById('g994771-sim'); if (st) st.remove(); });
    await p.waitForTimeout(300);
  }
  sonuc.push({ ad: bl.ad, durum: 'ok' });
}
// yan yana birleştir
const birlesik = [];
for (const s of sonuc) {
  if (s.durum !== 'ok' || SIM === '-') continue;
  const a = fs.readFileSync(`${ONEK}-${s.ad}-A.png`).toString('base64');
  const bb = fs.readFileSync(`${ONEK}-${s.ad}-B.png`).toString('base64');
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: 1400, height: 400 });
  await pg.setContent(`<html><body style="margin:0;background:#f4f4f5;font:600 15px/1.4 -apple-system,Inter,sans-serif;color:#1a1a1a">
  <div style="display:flex;gap:24px;padding:16px;align-items:flex-start">
   <figure style="margin:0;flex:1"><figcaption style="padding:0 0 8px">ÖNCE — canlı (${MOBIL ? 'mobil 430' : 'PC 1440'} · ${s.ad})</figcaption><img style="width:100%;background:#fff;border:1px solid #ddd" src="data:image/png;base64,${a}"></figure>
   <figure style="margin:0;flex:1"><figcaption style="padding:0 0 8px">SONRA — 4px ızgara yaması (#994771)</figcaption><img style="width:100%;background:#fff;border:1px solid #ddd" src="data:image/png;base64,${bb}"></figure>
  </div></body></html>`);
  await pg.waitForTimeout(300);
  const yol = `${ONEK}-${s.ad}-AB.png`;
  await pg.screenshot({ path: yol, fullPage: true });
  await pg.close();
  birlesik.push(yol);
}
console.log(JSON.stringify({ sonuc, birlesik }));
await b.close();
