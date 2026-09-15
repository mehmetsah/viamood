import { chromium } from 'playwright';
const W=Number(process.argv[2]??390);
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:W,height:900}});
const say=(...a)=>console.log('  ',...a);
try{
  await p.goto('https://viamood.com.tr/',{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(20000); // pop-up 15sn gecikmeli
  const once=await p.evaluate(()=>{
    const el=[...document.querySelectorAll('div,section,dialog')].find(e=>{
      const s=getComputedStyle(e); const r=e.getBoundingClientRect();
      return s.position==='fixed' && r.width>200 && r.height>200 && parseInt(s.zIndex||'0')>500 && r.top>=0;
    });
    return el?{sinif:el.className.slice(0,50),z:getComputedStyle(el).zIndex,w:Math.round(el.getBoundingClientRect().width)}:null;
  });
  say('pop-up gorunur mu:',once?JSON.stringify(once):'hayir');
  await p.evaluate(()=>{const btn=document.querySelector('button[aria-label*="Ara" i], [class*="search"] button, button[class*="search"]'); if(btn) btn.click();});
  await p.waitForTimeout(2500);
  const sonra=await p.evaluate(()=>{
    const dlg=document.querySelector('dialog[open]');
    const dz=dlg?parseInt(getComputedStyle(dlg).zIndex||'0'):null;
    const kapatan=[...document.querySelectorAll('div,section')].filter(e=>{
      const s=getComputedStyle(e); const r=e.getBoundingClientRect();
      return s.position==='fixed'&&r.width>200&&r.height>200&&parseInt(s.zIndex||'0')>=(dz??0)&&s.visibility!=='hidden'&&s.display!=='none';
    }).map(e=>({sinif:e.className.slice(0,44),z:getComputedStyle(e).zIndex}));
    return { aramaModaliAcik: !!dlg, modalZ: dz, ustunde: kapatan.slice(0,3) };
  });
  say('arama modali acik :',sonra.aramaModaliAcik,'· z-index:',sonra.modalZ);
  say('ustunu kapatanlar :',JSON.stringify(sonra.ustunde));
  await p.screenshot({path:`/tmp/786-cakisma-${W}.png`});
} finally{ await b.close(); }
