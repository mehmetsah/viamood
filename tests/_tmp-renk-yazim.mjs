// Stylesheet İÇİNDE hangi renk yazımı GERÇEKTEN hesaplanıyor? (inline çalışıyor, kural düşüyor)
import { chromium } from 'playwright';
const URL='https://via-mood.myshopify.com/products/5-adet-cekmece-ici-bicaklik-kasiklik-organizer';
const b=await chromium.launch({channel:'chrome'});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto(URL,{waitUntil:'load',timeout:60000});
try{ await p.getByRole('button',{name:/Kabul Et/i}).first().click({timeout:6000}); }catch{}
await p.waitForTimeout(500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const bar=document.querySelector('.sticky-add-to-cart__bar');
  bar.insertAdjacentHTML('afterbegin','<div class="tx" style="color:rgba(0,0,0,.7)"><span class="ty"><strong class="tz">RAKAM</strong></span></div>');
  const el=bar.querySelector('.tz');
  const adaylar=[
    'rgb(var(--color-foreground-rgb))',
    'rgb(var(--color-foreground-rgb) / 1)',
    'rgba(var(--color-foreground-rgb), 1)',
    'var(--color-foreground)',
    'currentColor',
  ];
  const out={}; 
  for(const v of adaylar){
    const st=document.createElement('style');
    st.textContent='.tx .tz{ color:'+v+'; }';
    document.head.appendChild(st);
    out[v]=getComputedStyle(el).color;
    st.remove();
  }
  out['__satirRengi']=getComputedStyle(bar.querySelector('.tx')).color;
  out['__varDegeri']=JSON.stringify(getComputedStyle(el).getPropertyValue('--color-foreground-rgb'));
  return out;
}),null,1));
await b.close();
