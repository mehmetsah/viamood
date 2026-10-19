import { chromium } from 'playwright';
const EXEC='/Users/mehmetsah/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const b=await chromium.launch({executablePath:EXEC});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('https://viamood.com.tr/products/5-adet-cekmece-ici-bicaklik-kasiklik-organizer',{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(2000);
// 1) h1 line-height NEREDEN geliyor?
console.log('A · h1 degisken izi:', JSON.stringify(await p.evaluate(()=>{
  const h=document.querySelector('h1'), cs=getComputedStyle(h);
  return {lh:cs.lineHeight, fs:cs.fontSize, sinif:h.className||'(sinifsiz)', ebeveyn:h.parentElement.className.slice(0,60),
    tok_h1:cs.getPropertyValue('--font-h1--line-height').trim(), tok_h2:cs.getPropertyValue('--font-h2--line-height').trim(),
    kokTok:getComputedStyle(document.documentElement).getPropertyValue('--font-h1--line-height').trim()};
})));
// 2) token'i :root'tan degistirmek yetiyor mu?
await p.addStyleTag({content:':root{--font-h1--line-height:1.32;--font-h2--line-height:1.32;--font-h3--line-height:1.32}'});
await p.waitForTimeout(400);
console.log('B · sadece :root token sonrasi:', JSON.stringify(await p.evaluate(()=>{
  const o={}; for (const s of ['h1','h2','h3']){const e=document.querySelector(s); if(!e) continue; const c=getComputedStyle(e);
    o[s]={lh:c.lineHeight, fs:c.fontSize, oran:+(parseFloat(c.lineHeight)/parseFloat(c.fontSize)).toFixed(3), tok:c.getPropertyValue('--font-h1--line-height').trim()};}
  return o;})));
// 3) ogeye dogrudan kural yazmak
await p.addStyleTag({content:'h1,h2,h3,h4,h5,h6,.h1,.h2,.h3{line-height:1.32!important}'});
await p.waitForTimeout(400);
console.log('C · oge kurali sonrasi:', JSON.stringify(await p.evaluate(()=>{
  const o={}; for (const s of ['h1','h2','h3']){const e=document.querySelector(s); if(!e) continue; const c=getComputedStyle(e), r=e.getBoundingClientRect();
    o[s]={oran:+(parseFloat(c.lineHeight)/parseFloat(c.fontSize)).toFixed(3), h:+r.height.toFixed(1)};}
  // kalan lh ihlali
  let n=0, liste=[];
  for (const el of document.querySelectorAll('main *, [class*=product] *')){
    const c=getComputedStyle(el); if(c.display==='none') continue;
    if(![...el.childNodes].some(x=>x.nodeType===3&&x.textContent.trim())) continue;
    const fs=parseFloat(c.fontSize), lh=c.lineHeight==='normal'?fs*1.2:parseFloat(c.lineHeight);
    if (lh/fs<1.3){n++; if(liste.length<6) liste.push(`${(lh/fs).toFixed(3)} ${el.tagName.toLowerCase()}.${(typeof el.className==='string'?el.className.trim().split(/\s+/)[0]:'')}`);}}
  return {o,kalan:n,liste};})));
// 4) h1 yukseklik etkisi
console.log('D · h1 yukseklik:', JSON.stringify(await p.evaluate(()=>{const r=document.querySelector('h1').getBoundingClientRect(); return {h:+r.height.toFixed(1)};})));
await b.close();
