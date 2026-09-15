import { chromium } from 'playwright';
const TEMA = process.argv[2]; const q = TEMA ? `?preview_theme_id=${TEMA}` : '';
const say = (...a) => console.log('  ', ...a);
const b = await chromium.launch(); const p = await b.newPage();
const sepet = () => p.evaluate(async () => { const c = await (await fetch('/cart.js')).json(); return { n: c.item_count, satir: c.items.map(i => `${i.title.slice(0,16)}x${i.quantity}`) }; });
try {
  say(TEMA ? `yamali tema ${TEMA}` : 'canli');
  // stogu BOL urun: Ahtapot Camasir Kurutma Askisi (stok 6)
  await p.goto('https://viamood.com.tr/products/ahtapot-camasir-kurutma-askisi' + q, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('button[name="add"]').first().click({ timeout: 20000 });
  await p.waitForTimeout(3000);
  await p.goto('https://viamood.com.tr/cart' + q, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  say('baslangic  :', JSON.stringify(await sepet()));

  say('A) adedi ARTTIR (stok yeterli, calismali)');
  await p.locator('cart-items-component button[name="plus"], .quantity-plus').first().click({ timeout: 15000 });
  await p.waitForTimeout(4000);
  const a = await sepet(); say('   sonuc:', JSON.stringify(a), a.n === 2 ? '✓ arttı' : '✗ ARTMADI');
  const ekran = await p.evaluate(() => document.querySelector('cart-quantity-selector-component input[data-cart-line]')?.value);
  say('   ekran adet:', ekran, String(ekran) === '2' ? '✓' : '✗');
  const uyariVar = await p.evaluate(() => { const k = document.querySelector('[ref^="cartItemErrorContainer"]'); return k ? !k.classList.contains('hidden') : false; });
  say('   yanlis uyari cikti mi:', uyariVar ? 'EVET ✗' : 'hayir ✓');

  say('B) adedi AZALT');
  await p.locator('cart-items-component button[name="minus"], .quantity-minus').first().click({ timeout: 15000 });
  await p.waitForTimeout(4000);
  const bb = await sepet(); say('   sonuc:', JSON.stringify(bb), bb.n === 1 ? '✓ azaldi' : '✗');

  say('C) satiri SIL');
  await p.locator('.cart-items__remove').first().click({ timeout: 15000 });
  await p.waitForTimeout(4500);
  const c = await sepet(); say('   sonuc:', JSON.stringify(c), c.n === 0 ? '✓ silindi' : '✗ SILINMEDI');
} finally { await b.close(); }
