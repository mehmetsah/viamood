import { chromium } from 'playwright';
const b = await chromium.launch();
const out = {};
async function olc(url, w, fn, ad) {
  const ctx = await b.newContext({ viewport:{width:w,height:900}, userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', isMobile:true, hasTouch:true });
  const p = await ctx.newPage();
  await p.goto(url, {waitUntil:'networkidle', timeout:60000}).catch(e=>console.log('goto hata',e.message));
  await p.waitForTimeout(2500);
  try { out[ad] = await fn(p); } catch(e){ out[ad] = 'HATA: '+e.message; }
  await ctx.close();
}
// M11 + #992999: anasayfa 430px yatay tasma
await olc('https://viamood.com.tr/', 430, async p => {
  const r = await p.evaluate(() => {
    const res = { docTasma: document.documentElement.scrollWidth - document.documentElement.clientWidth, clientW: document.documentElement.clientWidth, izgaralar: [], tasanlar: [] };
    document.querySelectorAll('.vmh2-products').forEach((g,i)=>{
      const cs=getComputedStyle(g); const rc=g.getBoundingClientRect();
      let gorunur=0; g.querySelectorAll(':scope > *').forEach(c=>{const b=c.getBoundingClientRect(); if(b.left>=-1 && b.right<=rc.right+1) gorunur++;});
      res.izgaralar.push({i, display:cs.display, gtc:cs.gridTemplateColumns, genislik:Math.round(rc.width), cocuk:g.children.length, gorunurKart:gorunur, yatayTasma:Math.round(g.scrollWidth-g.clientWidth), slider:g.className.includes('slider')});
    });
    document.querySelectorAll('body *').forEach(el=>{const b=el.getBoundingClientRect(); if(b.width>0 && (b.right>res.clientW+2 || b.left<-2) && getComputedStyle(el).position!=='fixed'){ if(res.tasanlar.length<12) res.tasanlar.push({et:el.tagName+'.'+(el.className||'').toString().slice(0,45), sag:Math.round(b.right), sol:Math.round(b.left), g:Math.round(b.width)});}});
    return res;
  });
  return r;
}, 'anasayfa430');
// M8/#992999: urun sayfasi 430px sticky bar + Hemen Al
await olc('https://viamood.com.tr/products/100-lt-saklama-kutusu-2li-set', 430, async p => {
  await p.evaluate(()=>window.scrollTo(0,1800)); await p.waitForTimeout(1500);
  return await p.evaluate(() => {
    const cw=document.documentElement.clientWidth;
    const sab=[...document.querySelectorAll('body *')].filter(e=>{const cs=getComputedStyle(e);return (cs.position==='fixed'||cs.position==='sticky') && e.getBoundingClientRect().height>20 && cs.visibility!=='hidden' && cs.display!=='none';}).map(e=>{const b=e.getBoundingClientRect();return {et:e.tagName+'.'+(e.className||'').toString().slice(0,50), pos:getComputedStyle(e).position, alt:Math.round(window.innerHeight-b.bottom), y:Math.round(b.top), h:Math.round(b.height), metin:(e.innerText||'').replace(/\s+/g,' ').slice(0,90)};});
    const btnler=[...document.querySelectorAll('button,a')].map(e=>(e.innerText||'').trim()).filter(t=>t&&t.length<30);
    const tasma=document.documentElement.scrollWidth-cw;
    return {docTasma:tasma, clientW:cw, sabitler:sab.slice(0,10), hemenAlVar: btnler.some(t=>/hemen al/i.test(t)), sepeteVar: btnler.some(t=>/sepete/i.test(t))};
  });
}, 'urun430');
console.log(JSON.stringify(out,null,1));
await b.close();
