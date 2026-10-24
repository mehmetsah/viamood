import { chromium } from 'playwright';
const url = process.argv[2], out = process.argv[3];
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, locale: 'tr-TR' });
const r = await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
console.log('status', r.status());
await p.waitForTimeout(1500);
await p.screenshot({ path: out + '.png', fullPage: false });
const info = await p.evaluate(() => {
  const g = [...document.querySelectorAll('.card-gallery')].slice(0, 8);
  return g.map(el => {
    const img = el.querySelector('img'); const mc = el.querySelector('.product-media-container');
    const cs = img && getComputedStyle(img); const r = el.getBoundingClientRect();
    return { ratioAttr: el.dataset.imageRatio, styleVar: el.style.getPropertyValue('--gallery-aspect-ratio'),
      box: [Math.round(r.width), Math.round(r.height)], mcClass: mc && mc.className,
      mcAR: mc && getComputedStyle(mc).aspectRatio, fit: cs && cs.objectFit, nat: img && [img.naturalWidth, img.naturalHeight],
      section: el.closest('[id^="shopify-section"]')?.id };
  });
});
console.log(JSON.stringify(info, null, 1));
await b.close();
