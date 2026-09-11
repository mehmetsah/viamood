/**
 * Anasayfa bölüm sırası + hero carousel regresyon ölçümü.
 * Yunus 11 Eyl 13:26 talebi: vmh2-categories → vmh2-yorumlar'ın ALTINA.
 * Aynı taslakta #981 hero carousel işi de duruyor; bozulmadığı doğrulanır.
 */
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';

const TASLAK = 'https://viamood.com.tr/?preview_theme_id=195348856964';
const OUT = '/tmp/vm-sira-shots';
fs.mkdirSync(OUT, { recursive: true });

const log = (a, b) => console.log(`  ${String(a).padEnd(42)} ${b}`);

async function engelKaldir(pg) {
  await pg.evaluate(() => {
    document.querySelectorAll('#PBarNextFrameWrapper, #PBarNextFrame, [id^="PBar"], #vmk-overlay')
      .forEach((e) => e.remove());
  });
}

const browser = await chromium.launch();

for (const [ad, cfg] of [
  ['MOBİL 390×844', { ...devices['iPhone 13'] }],
  ['MASAÜSTÜ 1440×900', { viewport: { width: 1440, height: 900 } }],
]) {
  console.log(`\n=== ${ad} ===`);
  const ctx = await browser.newContext({ ...cfg, locale: 'tr-TR' });
  const page = await ctx.newPage();
  await page.goto(TASLAK, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('.vmh2-hero').waitFor({ state: 'visible', timeout: 30000 });
  await engelKaldir(page);
  await page.waitForTimeout(1500);

  // ── 1) Sayfadaki gerçek bölüm sırası (DOM konumuna göre) ─────────────────
  const sira = await page.evaluate(() =>
    [...document.querySelectorAll('section[id^="vmh2-"], .vmh2-hero')].map((el) => ({
      id: el.id || '(hero)',
      y: Math.round(el.getBoundingClientRect().top + scrollY),
      gorunur: el.offsetParent !== null || el.classList.contains('vmh2-hero'),
    })).sort((a, b) => a.y - b.y));

  console.log('  --- sayfadaki sıra (yukarıdan aşağıya) ---');
  sira.forEach((s, i) => log(`  ${i + 1}. ${s.id}`, `y=${s.y}${s.gorunur ? '' : ' (gizli)'}`));

  const iY = (id) => sira.find((s) => s.id === id)?.y ?? -1;
  const yorum = iY('vmh2-yorumlar');
  const kat = iY('vmh2-categories');
  log('yorumlar y', yorum);
  log('kategoriler y', kat);
  log('kategoriler YORUMLARIN ALTINDA', kat > yorum && yorum > 0 ? 'EVET ✓' : 'HAYIR ✗');

  // Araya başka bölüm girmiş mi (hemen altında olmalı)
  const arada = sira.filter((s) => s.y > yorum && s.y < kat).map((s) => s.id);
  log('yorumlar ile kategoriler arası', arada.length ? `${arada.join(', ')} (araya girdi)` : 'BOŞ ✓ (hemen altında)');

  // ── 2) Hero carousel regresyon (#981 bozulmadı mı) ──────────────────────
  console.log('  --- hero carousel (#981) kontrolü ---');
  const hero = await page.evaluate(() => {
    const h = document.querySelector('.vmh2-hero');
    const img = h.querySelector('.vmh2-hero-media img.vmh2-hm-gorunur');
    return {
      var: !!h,
      banner: h.classList.contains('vmh2-hero--banner'),
      gorsel: img ? img.src.split('/').pop().split('?')[0] : null,
      okSayisi: h.querySelectorAll('.vmh2-hs-ok').length,
      nokta: h.querySelectorAll('.vmh2-hs-dots button').length,
      oran: +(h.getBoundingClientRect().width / h.getBoundingClientRect().height).toFixed(3),
    };
  });
  log('hero var / banner modu', `${hero.var ? '✓' : '✗'} / ${hero.banner ? '✓' : '✗'}`);
  log('yeni banner yüklü', hero.gorsel?.startsWith('via-hero-2609') ? `EVET ✓ (${hero.gorsel})` : `HAYIR ✗ (${hero.gorsel})`);
  log('ok sayısı / nokta sayısı', `${hero.okSayisi} / ${hero.nokta}`);
  log('hero oranı', `${hero.oran} ${Math.abs(hero.oran - 2.263) < 0.02 ? '✓' : '✗'}`);

  // ok gerçekten çalışıyor mu
  const once = await page.evaluate(() =>
    document.querySelector('.vmh2-hero-media img.vmh2-hm-gorunur').src.split('/').pop().split('?')[0]);
  await engelKaldir(page);
  await page.click('[data-vmh2-next]');
  await page.waitForTimeout(900);
  const sonra = await page.evaluate(() =>
    document.querySelector('.vmh2-hero-media img.vmh2-hm-gorunur').src.split('/').pop().split('?')[0]);
  log('ileri oku slayt değiştiriyor', once !== sonra ? `EVET ✓ (${once} → ${sonra})` : `HAYIR ✗ (${once} sabit)`);

  const etiket = ad.split(' ')[0].toLowerCase();
  await page.evaluate((y) => scrollTo(0, Math.max(0, y - 80)), yorum);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${etiket}-yorumlar-kategoriler.png`, fullPage: false });

  await ctx.close();
}

await browser.close();
console.log(`\nEkran görüntüleri: ${OUT}/`);
