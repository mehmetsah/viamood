import { chromium } from 'playwright';
const b=await chromium.launch({channel:'chrome'});
const p=await (await b.newContext({viewport:{width:430,height:860},isMobile:true,hasTouch:true,
 userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'})).newPage();
await p.goto('https://via-mood.myshopify.com/products/5-adet-cekmece-ici-bicaklik-kasiklik-organizer',{waitUntil:'load',timeout:60000});
try{ await p.getByRole('button',{name:/Kabul Et/i}).first().click({timeout:6000}); }catch(e){}
for(let i=0;i<10;i++){ await p.mouse.wheel(0,1400); await p.waitForTimeout(400);
  if(await p.evaluate(()=>document.querySelector('.sticky-add-to-cart__bar')?.dataset.stuck==='true')) break; }
console.log(JSON.stringify(await p.evaluate(()=>{
  const g=s=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect();
    return {s, ust:Math.round(r.top), alt:Math.round(r.bottom), sol:Math.round(r.left), sag:Math.round(r.right), z:getComputedStyle(e).zIndex};};
  const aday=['.sticky-add-to-cart__bar','.sticky-add-to-cart__bar > .vks-satir','.sticky-add-to-cart__button',
    '[class*="mobil-nav"]','[class*="bottom-nav"]','[class*="alt-menu"]','nav[class*="mobile"]','.via-mobil-nav','[class*="whatsapp"]'];
  return aday.map(g).filter(Boolean);
}),null,1));
await b.close();
