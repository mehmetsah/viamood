// --color-foreground-rgb GERÇEKTEN ne çözüyor? madde 3'ün neden tutmadığını ölç.
import { chromium } from 'playwright';
const URL='https://via-mood.myshopify.com/products/5-adet-cekmece-ici-bicaklik-kasiklik-organizer';
const b=await chromium.launch({channel:'chrome'});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto(URL,{waitUntil:'load',timeout:60000});
try{ await p.getByRole('button',{name:/Kabul Et/i}).first().click({timeout:6000}); }catch{}
await p.waitForTimeout(500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const bar=document.querySelector('.sticky-add-to-cart__bar');
  const cs=getComputedStyle(bar);
  const probe=document.createElement('span'); bar.appendChild(probe);
  const dene=(v)=>{ probe.style.color=''; probe.style.color=v; return getComputedStyle(probe).color; };
  const sonuc={
    degiskenler:{
      foregroundRgb: JSON.stringify(cs.getPropertyValue('--color-foreground-rgb')),
      foreground:    JSON.stringify(cs.getPropertyValue('--color-foreground')),
      opacitySubdued:JSON.stringify(cs.getPropertyValue('--opacity-subdued-text')),
    },
    denemeler:{
      'rgb(var(--color-foreground-rgb))': dene('rgb(var(--color-foreground-rgb))'),
      'rgba(var(--color-foreground-rgb))': dene('rgba(var(--color-foreground-rgb))'),
      'rgb(var(--color-foreground-rgb) / 1)': dene('rgb(var(--color-foreground-rgb) / 1)'),
      'var(--color-foreground)': dene('var(--color-foreground)'),
      'rgba(var(--color-foreground-rgb), 1)': dene('rgba(var(--color-foreground-rgb), 1)'),
    },
    barRengi: cs.color,
  };
  probe.remove(); return sonuc;
}),null,1));
await b.close();
