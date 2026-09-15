import { chromium } from 'playwright';
const TEMA = process.argv[2];
const q = TEMA ? `?preview_theme_id=${TEMA}` : '';
const say = (...a) => console.log('  ', ...a);
const b = await chromium.launch();
const p = await b.newPage();
const istekler = [];
p.on('response', (r) => r.url().includes('/cart/') && istekler.push(`${r.status()} ${r.url().split('/').pop().split('?')[0]}`));
try {
  say(TEMA ? `TEMA: ${TEMA} (yamali)` : 'TEMA: canli (yamasiz)');
  await p.goto('https://viamood.com.tr/products/teleskopik-camasir-sepeti' + q, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('button[name="add"]').first().click({ timeout: 20000 });
  await p.waitForTimeout(3000);
  await p.goto('https://viamood.com.tr/cart' + q, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);

  await p.locator('cart-items-component button[name="plus"], .quantity-plus').first().click({ timeout: 15000 });
  await p.waitForTimeout(4000);

  const sonuc = await p.evaluate(async () => {
    const kap = document.querySelector('[ref^="cartItemErrorContainer"]');
    const alan = document.querySelector('[ref^="cartItemError-"]');
    const inp = document.querySelector('cart-quantity-selector-component input[data-cart-line]');
    const c = await (await fetch('/cart.js')).json();
    return {
      uyariGorunur: kap ? !kap.classList.contains('hidden') : null,
      uyariMetni: alan ? alan.textContent.trim().slice(0, 60) : '',
      ekranAdet: inp ? inp.value : '?',
      sunucuAdet: c.items[0]?.quantity ?? 0,
      sepetKalem: c.item_count,
    };
  });
  say('uyari gorunur   :', sonuc.uyariGorunur ? 'EVET ✓' : 'hayir ✗');
  say('uyari metni     :', sonuc.uyariMetni || '(bos)');
  say('ekran adet      :', sonuc.ekranAdet, '| sunucu adet:', sonuc.sunucuAdet, '→', String(sonuc.ekranAdet) === String(sonuc.sunucuAdet) ? 'TUTARLI ✓' : 'AYRISMIS ✗');
  say('sepet kalem     :', sonuc.sepetKalem, sonuc.sepetKalem > 0 ? '(bosalmadi ✓)' : '(BOSALDI ✗)');
  say('istekler        :', istekler.join(' · '));
  await p.screenshot({ path: `/tmp/857-${TEMA || 'canli'}.png` });
} finally { await b.close(); }
