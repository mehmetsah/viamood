// .vks-satir strong NEDEN tutmadı? Hangi kural kazanıyor?
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const kaynak=readFileSync('/Users/mehmetsah/kod-viamood/tema-yamalari/via-kargo-sayaci.liquid.994352-SATIR-KIPI','utf8');
const cssTam=kaynak.match(/<style>([\s\S]*?)<\/style>/)[1];
const html=kaynak.match(/<div class="vks-satir"[\s\S]*?<\/div>/)[0]
  .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g,'')   // Liquid'in yaptığı
  .replace(/data-vks /,'data-vks2 ');
const URL='https://via-mood.myshopify.com/products/5-adet-cekmece-ici-bicaklik-kasiklik-organizer';
const b=await chromium.launch({channel:'chrome'});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto(URL,{waitUntil:'load',timeout:60000});
try{ await p.getByRole('button',{name:/Kabul Et/i}).first().click({timeout:6000}); }catch{}
await p.waitForTimeout(500);
console.log(JSON.stringify(await p.evaluate(([css,h])=>{
  document.querySelectorAll('[data-vks]').forEach(n=>{n.removeAttribute('data-vks');n.remove();});
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  const bar=document.querySelector('.sticky-add-to-cart__bar');
  bar.insertAdjacentHTML('afterbegin',h);
  const n=bar.querySelector('[data-vks2]'), s=n.querySelector('[data-vks-gun]');
  // enjekte edilen style sheet'teki .vks-satir strong kuralı ayrıştı mı?
  const kurallar=[...st.sheet.cssRules].filter(r=>r.selectorText&&/vks-satir/.test(r.selectorText))
    .map(r=>({sec:r.selectorText, color:r.style.color, fw:r.style.fontWeight}));
  return { strongRengi:getComputedStyle(s).color, satirRengi:getComputedStyle(n).color,
           ayristirilanKurallar:kurallar };
},[cssTam,html]),null,1));
await b.close();
