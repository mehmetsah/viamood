/**
 * Hoş geldin pop-up — mobil doğrulama (Defter #974).
 * Önizleme temasında (yayında olmayan kopya) koşar; canlıya dokunmaz.
 *
 *   node tests/welcome-popup-mobile.mjs
 */
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';

const PREVIEW = 'https://viamood.com.tr/?preview_theme_id=195347480708';
const OUT = '/tmp/vm-popup';
fs.mkdirSync(OUT, { recursive: true });


/** Shopify önizleme çubuğu (PBar) tıklamaları engelliyor — önizlemeye özgü, kaldır. */
async function pbarKaldir(pg) {
  await pg.evaluate(() => {
    document.querySelectorAll('#PBarNextFrameWrapper, #PBarNextFrame, [id^="PBar"]').forEach((e) => e.remove());
  });
}

const sonuc = [];
const not = (ad, deger) => { sonuc.push([ad, deger]); console.log(`  ${ad.padEnd(46)} ${deger}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'tr-TR' });
const page = await ctx.newPage();

console.log('\n=== MOBİL (iPhone 13 · 390×844) ===');
await page.goto(PREVIEW, { waitUntil: 'domcontentloaded', timeout: 60000 });

const ov = page.locator('#vhg-overlay');
not('pop-up DOM’da var', (await ov.count()) === 1 ? 'EVET' : 'HAYIR');
not('açılıştan hemen sonra gizli', await ov.isHidden() ? 'EVET (doğru)' : 'HAYIR');

// 15 sn gecikme — 17 sn'ye kadar bekle
const t0 = Date.now();
await ov.waitFor({ state: 'visible', timeout: 25000 });
not('görünür oldu (sn)', ((Date.now() - t0) / 1000).toFixed(1));

await pbarKaldir(page);
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/01-mobil-acilis.png` });

// ── Taşma ve ölçü kontrolleri ──────────────────────────────────────────────
const olcum = await page.evaluate(() => {
  const card = document.querySelector('.vhg-card');
  const r = card.getBoundingClientRect();
  const btn = document.querySelector('.vhg-gonder').getBoundingClientRect();
  const close = document.querySelector('.vhg-close').getBoundingClientRect();
  const inputs = [...document.querySelectorAll('.vhg-alan input')].map((i) => {
    const b = i.getBoundingClientRect();
    return { h: Math.round(b.height), fs: getComputedStyle(i).fontSize };
  });
  const scroll = document.querySelector('.vhg-scroll');
  return {
    vw: innerWidth, vh: innerHeight,
    kart: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    buton: { w: Math.round(btn.width), h: Math.round(btn.height) },
    kapat: { w: Math.round(close.width), h: Math.round(close.height) },
    inputs,
    icerikKayar: scroll.scrollHeight > scroll.clientHeight,
    yatayTasma: document.documentElement.scrollWidth > innerWidth,
  };
});

not('viewport', `${olcum.vw}×${olcum.vh}`);
not('kart konum/boyut', `x=${olcum.kart.x} y=${olcum.kart.y} ${olcum.kart.w}×${olcum.kart.h}`);
not('kart ekrana sığıyor', olcum.kart.y >= 0 && olcum.kart.y + olcum.kart.h <= olcum.vh ? 'EVET' : 'HAYIR');
not('yatay taşma', olcum.yatayTasma ? 'VAR (kötü)' : 'YOK');
not('gönder butonu yüksekliği', `${olcum.buton.h}px ${olcum.buton.h >= 44 ? '(≥44 ✓)' : '(<44 ✗)'}`);
not('kapat butonu', `${olcum.kapat.w}×${olcum.kapat.h} ${olcum.kapat.w >= 40 ? '(≥40 ✓)' : '(<40 ✗)'}`);
not('input font-size (iOS zoom eşiği 16px)', olcum.inputs.map((i) => i.fs).join(' / '));
not('input yükseklikleri', olcum.inputs.map((i) => i.h + 'px').join(' / '));

// ── Doğrulama: boş gönderim ────────────────────────────────────────────────
await pbarKaldir(page);
await page.click('[data-vhg-submit]');
await page.waitForTimeout(300);
const bosHatalar = await page.evaluate(() =>
  [...document.querySelectorAll('.vhg-hata')].map((e) => e.textContent.trim()).filter(Boolean));
not('boş gönderimde hata sayısı', `${bosHatalar.length} → ${bosHatalar.join(' | ')}`);
await page.screenshot({ path: `${OUT}/02-mobil-bos-gonderim.png` });

// ── Doğrulama: hatalı e-posta + hatalı telefon + onaysız ───────────────────
await page.fill('input[name="name"]', 'Deneme Kullanıcı');
await page.fill('input[name="email"]', 'bozuk-eposta');
await page.fill('input[name="phone"]', '12345');
await page.click('[data-vhg-submit]');
await page.waitForTimeout(300);
const hatali = await page.evaluate(() => ({
  email: document.querySelector('[data-vhg-hata="email"]').textContent.trim(),
  phone: document.querySelector('[data-vhg-hata="phone"]').textContent.trim(),
  consent: document.querySelector('[data-vhg-hata="consent"]').textContent.trim(),
}));
not('hatalı e-posta yakalandı', hatali.email ? 'EVET' : 'HAYIR');
not('hatalı telefon yakalandı', hatali.phone ? 'EVET' : 'HAYIR');
not('onaysız gönderim engellendi', hatali.consent ? 'EVET' : 'HAYIR');

// ── Klavye simülasyonu: input’a odaklanınca görünür mü ─────────────────────
await page.fill('input[name="email"]', 'deneme@example.com');
await page.fill('input[name="phone"]', '0532 111 22 33');
await page.focus('input[name="phone"]');
await page.waitForTimeout(600);
const odak = await page.evaluate(() => {
  const b = document.activeElement.getBoundingClientRect();
  return { ad: document.activeElement.name, ust: Math.round(b.top), alt: Math.round(b.bottom), vh: innerHeight };
});
not('odaklı alan görünür alanda', `${odak.ad}: ${odak.ust}–${odak.alt} / ${odak.vh} ${odak.alt <= odak.vh && odak.ust >= 0 ? '✓' : '✗'}`);
await page.screenshot({ path: `${OUT}/03-mobil-dolu-form.png` });

// ── İndirim kodu sızıntısı kontrolü ────────────────────────────────────────
const html = await page.content();
not('HTML’de indirim kodu', /XX10VIA/i.test(html) ? 'SIZDI (kötü)' : 'YOK ✓');
const jsKaynak = await page.evaluate(async () => {
  const src = [...document.querySelectorAll('script')].map((s) => s.textContent).join('\n');
  return src;
});
not('inline JS’te indirim kodu', /XX10VIA/i.test(jsKaynak) ? 'SIZDI (kötü)' : 'YOK ✓');

// ── Kapatınca 30 gün hatırlama ─────────────────────────────────────────────
await page.click('[data-vhg-close]');
await page.waitForTimeout(600);
const hafiza = await page.evaluate(() => ({
  ls: localStorage.getItem('vhg_hosgeldin_kapali'),
  cookie: document.cookie.includes('vhg_hosgeldin_kapali'),
  gizli: document.getElementById('vhg-overlay').hidden,
}));
not('kapatınca gizlendi', hafiza.gizli ? 'EVET' : 'HAYIR');
not('localStorage damgası', hafiza.ls ? 'YAZILDI' : 'YOK');
not('çerez yedeği', hafiza.cookie ? 'YAZILDI' : 'YOK');

// Yeniden yükle → bir daha çıkmamalı
await page.reload({ waitUntil: 'domcontentloaded' });
await pbarKaldir(page);
await page.waitForTimeout(18000);
not('yeniden yüklemede tekrar çıktı mı', await page.locator('#vhg-overlay').isHidden() ? 'HAYIR ✓ (doğru)' : 'EVET ✗');

// ── Masaüstü kontrolü ──────────────────────────────────────────────────────
console.log('\n=== MASAÜSTÜ (1440×900) ===');
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'tr-TR' });
const p2 = await ctx2.newPage();
await p2.goto(PREVIEW, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p2.locator('#vhg-overlay').waitFor({ state: 'visible', timeout: 25000 });
await pbarKaldir(p2);
await p2.waitForTimeout(600);
await p2.screenshot({ path: `${OUT}/04-masaustu.png` });
const d = await p2.evaluate(() => {
  const r = document.querySelector('.vhg-card').getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), sigar: r.top >= 0 && r.bottom <= innerHeight };
});
not('masaüstü kart', `${d.w}×${d.h} sığıyor=${d.sigar ? 'EVET' : 'HAYIR'}`);

await browser.close();
console.log(`\nEkran görüntüleri: ${OUT}/`);
fs.writeFileSync(`${OUT}/olcum.json`, JSON.stringify(Object.fromEntries(sonuc), null, 2));
