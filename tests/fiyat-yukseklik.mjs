import { chromium } from 'playwright';
const TEMA=process.argv[2]; const q=TEMA?`?preview_theme_id=${TEMA}`:'';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:900}});
const say=(...a)=>console.log('  ',...a);
try{
  await p.goto('https://viamood.com.tr/collections/cok-satanlar-1'+q,{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(3500);
  await p.evaluate(()=>{document.querySelectorAll('.vmk-overlay,#vm-cookie').forEach(e=>e.remove());});
  await p.evaluate(async()=>{for(let i=0;i<4;i++){window.scrollBy(0,700);await new Promise(r=>setTimeout(r,300));}});
  await p.waitForTimeout(1500);
  const d=await p.evaluate(()=>{
    const yu=n=>Math.round(n*10)/10;
    const k=[...document.querySelectorAll('article.vkol2-card')].slice(0,14).map(c=>({
      h:yu(c.getBoundingClientRect().height), indirimli:!!c.querySelector('.vkol2-old'),
      fiyatSatirH: (()=>{const s=c.querySelector('.vkol2-price'); return s?yu(s.parentElement.getBoundingClientRect().height):null;})() }));
    const u=a=>[...new Set(a)];
    return { toplam:k.length, indirimli:k.filter(x=>x.indirimli).length,
      indirimliH:u(k.filter(x=>x.indirimli).map(x=>x.h)), normalH:u(k.filter(x=>!x.indirimli).map(x=>x.h)),
      fiyatSatiri:u(k.map(x=>x.fiyatSatirH)) };
  });
  say(TEMA?'YAMALI':'CANLI', JSON.stringify(d));
} finally{ await b.close(); }
