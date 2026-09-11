/**
 * Hero carousel — görsel değişimi + ok kontrolü ölçümü (Yunus 11 Eyl 2026).
 * Taslak temada koşar; canlıya dokunmaz.
 *
 *   node olc-hero.mjs
 */
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';

const TASLAK = 'https://viamood.com.tr/?preview_theme_id=195348856964';
const OUT = '/tmp/vm-hero-shots';
fs.mkdirSync(OUT, { recursive: true });

const BEKLENEN = [
  ['via-hero-2609-1-setler.jpg', '/collections/saklama-kabi'],
  ['via-hero-2609-2-hobi.jpg', '/collections/hobi-1'],
  ['via-hero-2609-3-mikrodalga.jpg', '/collections/saklama-duzen'],
  ['via-hero-2609-4-oyuncak.jpg', '/collections/oyuncak'],
];

const log = (a, b) => console.log(`  ${String(a).padEnd(44)} ${b}`);
const rapor = {};

async function pbarKaldir(pg) {
  await pg.evaluate(() => {
    // Shopify önizleme çubuğu + bu taslakta hâlâ duran ESKİ kampanya pop-up'ı
    // (vmk-overlay) tıklamaları engelliyor. İkisi de ölçüme ait engeller, kaldır.
    document.querySelectorAll('#PBarNextFrameWrapper, #PBarNextFrame, [id^="PBar"], #vmk-overlay').forEach((e) => e.remove());
  });
}

/** Aktif slaydın görseli + hero linkinin href'i. */
const durum = (pg) => pg.evaluate(() => {
  const hero = document.querySelector('.vmh2-hero');
  const gorunur = hero.querySelector('.vmh2-hero-media img.vmh2-hm-gorunur');
  const link = hero.querySelector('[data-vmh2-hero-link]');
  const aktifNokta = [...hero.querySelectorAll('.vmh2-hs-dots button')].findIndex((d) => d.className === 'aktif');
  return {
    gorsel: gorunur ? gorunur.src.split('/').pop().split('?')[0] : null,
    href: link ? new URL(link.getAttribute('href'), location.origin).pathname : null,
    nokta: aktifNokta,
  };
});

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
  await pbarKaldir(page);
  await page.waitForTimeout(1200);

  const etiket = ad.split(' ')[0].toLowerCase();

  // ── Hero ölçüleri + kırpma kontrolü ──────────────────────────────────────
  const geo = await page.evaluate(() => {
    const hero = document.querySelector('.vmh2-hero');
    const r = hero.getBoundingClientRect();
    const img = hero.querySelector('.vmh2-hero-media img.vmh2-hm-gorunur');
    const geri = hero.querySelector('[data-vmh2-prev]')?.getBoundingClientRect();
    const ileri = hero.querySelector('[data-vmh2-next]')?.getBoundingClientRect();
    return {
      hero: { w: Math.round(r.width), h: Math.round(r.height), oran: +(r.width / r.height).toFixed(3) },
      dogalOran: img ? +(img.naturalWidth / img.naturalHeight).toFixed(3) : null,
      geri: geri ? { w: Math.round(geri.width), h: Math.round(geri.height), x: Math.round(geri.x) } : null,
      ileri: ileri ? { w: Math.round(ileri.width), h: Math.round(ileri.height), x: Math.round(ileri.x) } : null,
      banner: hero.classList.contains('vmh2-hero--banner'),
      yatayTasma: document.documentElement.scrollWidth > innerWidth,
    };
  });
  log('banner modu', geo.banner ? 'AÇIK' : 'KAPALI');
  log('hero kutusu', `${geo.hero.w}×${geo.hero.h} oran=${geo.hero.oran}`);
  log('görselin doğal oranı', geo.dogalOran);
  const kirpma = Math.abs(geo.hero.oran - geo.dogalOran) < 0.02;
  log('kırpma var mı', kirpma ? 'YOK ✓ (oranlar eşleşiyor)' : `VAR ✗ (fark ${(geo.hero.oran - geo.dogalOran).toFixed(3)})`);
  log('yatay taşma', geo.yatayTasma ? 'VAR ✗' : 'YOK ✓');
  log('geri oku', `${geo.geri.w}×${geo.geri.h} @x=${geo.geri.x} ${geo.geri.w >= 44 ? '(≥44 ✓)' : '(<44 ✗)'}`);
  log('ileri oku', `${geo.ileri.w}×${geo.ileri.h} @x=${geo.ileri.x} ${geo.ileri.w >= 44 ? '(≥44 ✓)' : '(<44 ✗)'}`);

  await page.screenshot({ path: `${OUT}/${etiket}-01-hero.png` });

  // ── 4 slayt: ileri okuyla dolaş, görsel+link doğrula ─────────────────────
  console.log('  --- İLERİ okuyla 4 slayt ---');
  const bas = await durum(page);
  const sira = [bas];
  for (let i = 0; i < 3; i++) {
    await pbarKaldir(page);
    await page.click('[data-vmh2-next]');
    await page.waitForTimeout(900);
    sira.push(await durum(page));
  }
  let hepsiDogru = true;
  sira.forEach((d, i) => {
    const [bg, bl] = BEKLENEN[(BEKLENEN.findIndex((x) => x[0] === bas.gorsel) + i) % 4];
    const ok = d.gorsel === bg && d.href === bl;
    if (!ok) hepsiDogru = false;
    log(`  slayt ${i + 1}`, `${d.gorsel} → ${d.href} ${ok ? '✓' : `✗ (beklenen ${bg} → ${bl})`}`);
  });
  log('4 slayt görsel+link doğru', hepsiDogru ? 'EVET ✓' : 'HAYIR ✗');
  await page.screenshot({ path: `${OUT}/${etiket}-02-son-slayt.png` });

  // ── GERİ oku ─────────────────────────────────────────────────────────────
  const oncesi = await durum(page);
  await pbarKaldir(page);
  await page.click('[data-vmh2-prev]');
  await page.waitForTimeout(900);
  const sonrasi = await durum(page);
  log('geri oku çalışıyor', sonrasi.nokta === (oncesi.nokta + 3) % 4 ? `EVET ✓ (${oncesi.nokta}→${sonrasi.nokta})` : `HAYIR ✗ (${oncesi.nokta}→${sonrasi.nokta})`);

  // ── Klavye erişilebilirliği ──────────────────────────────────────────────
  const klavye = await page.evaluate(() => {
    const b = document.querySelector('[data-vmh2-next]');
    b.focus();
    return {
      odakli: document.activeElement === b,
      etiketGeri: document.querySelector('[data-vmh2-prev]').getAttribute('aria-label'),
      etiketIleri: b.getAttribute('aria-label'),
      tag: b.tagName,
    };
  });
  log('klavye odağı alıyor', `${klavye.odakli ? 'EVET ✓' : 'HAYIR ✗'} (<${klavye.tag.toLowerCase()}>)`);
  log('aria-label', `"${klavye.etiketGeri}" / "${klavye.etiketIleri}"`);

  const oncekiNokta = (await durum(page)).nokta;
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  log('Enter ile ilerliyor', (await durum(page)).nokta === (oncekiNokta + 1) % 4 ? 'EVET ✓' : 'HAYIR ✗');

  // ── Otomatik geçiş hâlâ çalışıyor mu (6.5 sn) ────────────────────────────
  const a = (await durum(page)).nokta;
  await page.waitForTimeout(8000);
  const b2 = (await durum(page)).nokta;
  log('otomatik geçiş korunuyor', a !== b2 ? `EVET ✓ (${a}→${b2})` : `HAYIR ✗ (${a} sabit)`);

  rapor[ad] = { geo, sira, hepsiDogru };
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/olcum.json`, JSON.stringify(rapor, null, 2));
console.log(`\nEkran görüntüleri: ${OUT}/`);
