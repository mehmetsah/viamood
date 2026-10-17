// #994352 madde 1 — CANLI doğrulama (basım sonrası): iki kopya da görünür ve tikliyor mu
import { chromium } from 'playwright';
const URL='https://via-mood.myshopify.com/products/5-adet-cekmece-ici-bicaklik-kasiklik-organizer';
const b=await chromium.launch({channel:'chrome'});
async function olc(ad, viewport, mobil){
  const p=await (await b.newContext({viewport, isMobile:mobil, hasTouch:mobil,
    userAgent: mobil? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1':undefined})).newPage();
  await p.goto(URL,{waitUntil:'load',timeout:60000});
  try{ await p.getByRole('button',{name:/Kabul Et/i}).first().click({timeout:6000}); }catch(e){}
  await p.waitForTimeout(700);
  const say=()=>p.evaluate(()=>Array.from(document.querySelectorAll('[data-vks]')).map(n=>({
    gizli:n.hasAttribute('hidden'), kip:n.getAttribute('data-vks-kip')||'kutu',
    yer:n.closest('.sticky-add-to-cart__bar')?'STICKY':'SAYFA',
    metin:(n.textContent||'').replace(/\s+/g,' ').trim().slice(0,75)})));
  const kutu=()=>p.evaluate(()=>{const el=document.querySelector('.sticky-add-to-cart__bar');if(!el)return null;
    const r=el.getBoundingClientRect();return{g:Math.round(r.width),y:Math.round(r.height),stuck:el.dataset.stuck};});
  for(let i=0;i<10&&(await kutu())?.stuck!=='true';i++){ await p.mouse.wheel(0,1400); await p.waitForTimeout(500); }
  console.log(`\n[${ad}] bar:`, JSON.stringify(await kutu()));
  console.log(`[${ad}] t0:`, JSON.stringify(await say()));
  await p.waitForTimeout(2000);
  console.log(`[${ad}] t+2sn:`, JSON.stringify(await say()));
  const hata=await p.evaluate(()=>document.body.innerText.includes('Liquid error')||document.body.innerText.includes('Liquid syntax'));
  console.log(`[${ad}] liquid hatasi:`, hata);
  await p.screenshot({path:`/tmp/994352-CANLI-${ad}.png`, fullPage:false});
  const r=await p.evaluate(()=>{const e=document.querySelector('.sticky-add-to-cart__bar').getBoundingClientRect();
    return{x:Math.max(0,e.x-14),y:Math.max(0,e.y-14),width:Math.min(e.width+28,innerWidth),height:e.height+28};});
  await p.screenshot({path:`/tmp/994352-CANLI-${ad}-bar.png`, clip:r});
  await p.close();
}
await olc('masaustu',{width:1440,height:900},false);
await olc('telefon',{width:430,height:860},true);
await b.close();
