import { chromium } from 'playwright';
const W = Number(process.argv[2] ?? 390);
const TEMA = process.argv[3];
const q = TEMA ? `?preview_theme_id=${TEMA}` : '';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: 900 } });
const say=(...a)=>console.log('  ',...a);
try {
  await p.goto('https://viamood.com.tr/collections/cok-satanlar-1' + q, { waitUntil:'load', timeout:60000 });
  await p.waitForTimeout(4000);
  await p.evaluate(async()=>{for(let i=0;i<5;i++){window.scrollBy(0,700);await new Promise(r=>setTimeout(r,350));}window.scrollTo(0,400);});
  await p.waitForTimeout(2500);
  const o = await p.evaluate(()=>{
    const yu=n=>Math.round(n*10)/10;
    return [...document.querySelectorAll('article.vkol2-card')].slice(0,12).map((k,i)=>{
      const kr=k.getBoundingClientRect();
      const t=k.querySelector('.vkol2-title, h3, h2, .vkol2-info a');
      const f=k.querySelector('.vkol2-price, .price, [class*="price"]');
      const ts=t?getComputedStyle(t):null;
      return { i,
        kartH:yu(kr.height),
        baslikSinif: t? t.className.slice(0,28) : null,
        baslikH: t?yu(t.getBoundingClientRect().height):null,
        satir: t&&ts ? Math.round(t.getBoundingClientRect().height/parseFloat(ts.lineHeight||'1')) : null,
        clamp: ts?.webkitLineClamp ?? 'yok',
        minH: ts?.minHeight ?? 'yok',
        fiyatOfs: f?yu(f.getBoundingClientRect().top-kr.top):null,
        metin:(t?.textContent??'').trim().slice(0,34) };
    });
  });
  const u=d=>[...new Set(d.filter(v=>v!=null))];
  say(`${W}px · ${o.length} kart`);
  say('başlık sınıfı  :', u(o.map(x=>x.baslikSinif)).join(' · '));
  say('line-clamp     :', u(o.map(x=>x.clamp)).join(' · '));
  say('min-height     :', u(o.map(x=>x.minH)).join(' · '));
  say('başlık yüksek. :', u(o.map(x=>x.baslikH)).join(' · '));
  say('satır sayısı   :', u(o.map(x=>x.satir)).join(' · '));
  say('FİYAT ofseti   :', u(o.map(x=>x.fiyatOfs)).join(' · '));
  say('kart yüksekliği:', u(o.map(x=>x.kartH)).join(' · '));
  say('');
  for(const x of o.slice(0,5)) say(`  #${x.i} h=${x.kartH} baslikH=${x.baslikH} fiyatOfs=${x.fiyatOfs} "${x.metin}"`);
} finally { await b.close(); }
