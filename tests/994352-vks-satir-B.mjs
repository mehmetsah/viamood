// #994352 madde 1 — ŞIK B: satır kipi, sabit çubuğun ÜSTÜNDE tam genişlik
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const yeni = readFileSync('/tmp/yeni-snippets__via-kargo-sayaci.liquid','utf8');
const css = yeni.match(/\/\* SATIR KİPİ[\s\S]*?\.vks-satir strong\{[^}]*\}/)[0];
const satirHtml = yeni.match(/<div class="vks-satir"[\s\S]*?<\/div>/)[0].replace(/\{\{[^}]*\}\}/, String(Math.floor(Date.now()/1000)));
const URL='https://via-mood.myshopify.com/products/5-adet-cekmece-ici-bicaklik-kasiklik-organizer';
const b=await chromium.launch({channel:'chrome'});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto(URL,{waitUntil:'load',timeout:60000});
try{ await p.getByRole('button',{name:/Kabul Et/i}).first().click({timeout:5000}); }catch(e){}
await p.waitForTimeout(600);
const kutu=()=>p.evaluate(()=>{const el=document.querySelector('.sticky-add-to-cart__bar');const r=el.getBoundingClientRect();return{g:Math.round(r.width),y:Math.round(r.height),stuck:el.dataset.stuck};});
for(let i=0;i<8&&(await kutu()).stuck!=='true';i++){ await p.mouse.wheel(0,1400); await p.waitForTimeout(500); }
console.log('1 · bar ÖNCE:', JSON.stringify(await kutu()));
await p.evaluate(([css,html])=>{
  const st=document.createElement('style');
  st.textContent = css + `
  .sticky-add-to-cart__bar{ flex-wrap:wrap; }
  .sticky-add-to-cart__bar > .vks-satir{ flex:0 0 100%; order:-1; margin-top:0; margin-bottom:2px;
    padding:0 2px; white-space:normal; }
  .sticky-add-to-cart__bar > .vks-satir .vks-satir__metin{ white-space:normal; }`;
  document.head.appendChild(st);
  document.querySelector('.sticky-add-to-cart__bar').insertAdjacentHTML('afterbegin', html);
  const n=document.querySelector('.sticky-add-to-cart__bar > .vks-satir'); n.hidden=false;
  n.querySelector('[data-vks-sure]').textContent='43 saat 28 dk';
  n.querySelector('[data-vks-gun]').textContent='Pazartesi kargoda';
},[css,satirHtml]);
await p.waitForTimeout(500);
console.log('2 · bar SONRA (B):', JSON.stringify(await kutu()));
const r=await p.evaluate(()=>{const e=document.querySelector('.sticky-add-to-cart__bar').getBoundingClientRect();return{x:Math.max(0,e.x-14),y:Math.max(0,e.y-14),width:e.width+28,height:e.height+28};});
await p.screenshot({path:'/tmp/994352-B-ustsatir-bar.png',clip:r});
await b.close();
