import { chromium } from 'playwright';
const W = Number(process.argv[2] ?? 390);
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:W,height:900} });
const say=(...a)=>console.log('  ',...a);
try {
  await p.goto('https://viamood.com.tr/', { waitUntil:'load', timeout:60000 });
  await p.waitForTimeout(3500);
  // once birkac urune bak ki "son goruntulenenler" dolsun
  for (const h of ['teleskopik-camasir-sepeti','ahtapot-camasir-kurutma-askisi']) {
    await p.goto(`https://viamood.com.tr/products/${h}`, { waitUntil:'domcontentloaded', timeout:60000 });
    await p.waitForTimeout(2200);
  }
  await p.goto('https://viamood.com.tr/', { waitUntil:'load', timeout:60000 });
  await p.waitForTimeout(3000);

  const acildi = await p.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="Ara" i], a[href="/search"], [class*="search"] button, button[class*="search"]');
    if (btn) { btn.click(); return true; }
    return false;
  });
  await p.waitForTimeout(2500);
  const d = await p.evaluate(() => {
    const yu=n=>Math.round(n*10)/10;
    const govde=document.body.innerText;
    const basligi=/son görüntülenen/i.test(govde);
    const dlg=document.querySelector('dialog[open], [class*="search"][open], [class*="predictive"]');
    const gorseller=[...document.querySelectorAll('dialog[open] img, [class*="predictive"] img')].slice(0,10)
      .map(i=>({w:yu(i.getBoundingClientRect().width),h:yu(i.getBoundingClientRect().height),fit:getComputedStyle(i).objectFit}));
    const yazilar=[...document.querySelectorAll('dialog[open] a, [class*="predictive"] a')].slice(0,10)
      .map(a=>({fs:getComputedStyle(a).fontSize,h:yu(a.getBoundingClientRect().height)}));
    return { modalAcik: !!dlg, sonGoruntulenenVar: basligi, gorselSayisi: gorseller.length,
      gorselBoyutlari:[...new Set(gorseller.map(g=>`${g.w}x${g.h}`))],
      objectFit:[...new Set(gorseller.map(g=>g.fit))],
      yaziBoyutlari:[...new Set(yazilar.map(y=>y.fs))] };
  });
  say(`${W}px · arama düğmesi tıklandı: ${acildi}`);
  say(JSON.stringify(d,null,2).replace(/\n/g,'\n   '));
  await p.screenshot({ path:`/tmp/786-arama-${W}.png` });
} finally { await b.close(); }
