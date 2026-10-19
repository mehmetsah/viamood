import { chromium } from 'playwright';
const EXEC='/Users/mehmetsah/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const b=await chromium.launch({executablePath:EXEC});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('https://viamood.com.tr/products/5-adet-cekmece-ici-bicaklik-kasiklik-organizer',{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(2000);
const olc=()=>{const o={};for(const s of ['h1','h2','h3']){const es=[...document.querySelectorAll(s)].filter(e=>e.getBoundingClientRect().height>0);
 o[s]=es.slice(0,2).map(e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();
  return {oran:+(parseFloat(c.lineHeight)/parseFloat(c.fontSize)).toFixed(3),fs:parseFloat(c.fontSize),h:+r.height.toFixed(1),txt:(e.textContent||'').trim().slice(0,18)};});}
 let n=0;for(const el of document.querySelectorAll('main *, [class*=product] *')){const c=getComputedStyle(el);if(c.display==='none')continue;
  if(![...el.childNodes].some(x=>x.nodeType===3&&x.textContent.trim()))continue;
  const fs=parseFloat(c.fontSize),lh=c.lineHeight==='normal'?fs*1.2:parseFloat(c.lineHeight); if(lh/fs<1.3)n++;}
 o.kalanLh=n; return o;};
console.log('ONCE :', JSON.stringify(await p.evaluate(olc)));
await p.addStyleTag({content:`:root{
  --line-height:1.32; --line-height--body-tight:1.32;
  --line-height--display-tight:1.32; --line-height--display-normal:1.32; --line-height--display-loose:1.38;
  --line-height--heading-tight:1.32; --line-height--heading-normal:1.34;
  --font-h1--line-height:1.32;--font-h2--line-height:1.32;--font-h3--line-height:1.32;
  --font-h4--line-height:1.34;--font-h5--line-height:1.40;--font-h6--line-height:1.40;}`});
await p.waitForTimeout(600);
console.log('TOKEN:', JSON.stringify(await p.evaluate(olc)));
await b.close();
