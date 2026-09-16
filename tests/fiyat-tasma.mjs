import { chromium } from 'playwright';
const W=Number(process.argv[2]??390); const TEMA=process.argv[3]; const q=TEMA?`?preview_theme_id=${TEMA}`:'';
const SAYFALAR=['/collections/cok-satanlar-1','/collections/indirim','/collections/mutfak','/collections/500-tl-alti'];
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:W,height:900}});
const say=(...a)=>console.log('  ',...a);
let toplam=0, tasan=0, enKotu=null;
try{
  for(const yol of SAYFALAR){
    await p.goto('https://viamood.com.tr'+yol+q,{waitUntil:'load',timeout:60000});
    await p.waitForTimeout(3000);
    await p.evaluate(()=>{document.querySelectorAll('.vmk-overlay,#vm-cookie').forEach(e=>e.remove());});
    await p.evaluate(async()=>{for(let i=0;i<4;i++){window.scrollBy(0,700);await new Promise(r=>setTimeout(r,300));}});
    await p.waitForTimeout(1500);
    const o=await p.evaluate(()=>{
      const yu=n=>Math.round(n*10)/10;
      return [...document.querySelectorAll('article.vkol2-card')].map(k=>{
        const old=k.querySelector('.vkol2-old'); if(!old) return null;
        const kr=k.getBoundingClientRect(), orr=old.getBoundingClientRect();
        const kap=old.parentElement, kpr=kap?.getBoundingClientRect();
        return { tasma:yu(orr.right-kr.right), kapTasma:kpr?yu(orr.right-kpr.right):null,
          metin:(k.querySelector('.vkol2-price')?.textContent??'').trim()+' / '+old.textContent.trim(),
          kesildi: old.scrollWidth>old.clientWidth+1,
          kapOverflow:kap?getComputedStyle(kap).overflow:null, kapWrap:kap?getComputedStyle(kap).flexWrap:null };
      }).filter(Boolean);
    });
    const t=o.filter(x=>x.tasma>0.5||x.kesildi);
    toplam+=o.length; tasan+=t.length;
    for(const x of t) if(!enKotu||x.tasma>enKotu.tasma) enKotu=x;
    say(`${yol.padEnd(30)} indirimli=${String(o.length).padStart(2)}  tasan/kesilen=${t.length}`);
    if(t.length) for(const x of t.slice(0,3)) say(`     ↳ "${x.metin}" tasma=${x.tasma}px kesildi=${x.kesildi}`);
  }
  say('');
  say(`TOPLAM: ${tasan}/${toplam} indirimli kartta sorun`, tasan?'✗':'✓');
  if(enKotu) say('en kotu:', JSON.stringify(enKotu));
} finally{ await b.close(); }
