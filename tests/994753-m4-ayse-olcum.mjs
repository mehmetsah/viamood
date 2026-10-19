import { chromium } from 'playwright';
const URL='https://viamood.com.tr/products/5-adet-cekmece-ici-bicaklik-kasiklik-organizer';
const VP = process.argv[2]==='mobil' ? {width:430,height:932} : {width:1440,height:900};
const b = await chromium.launch({executablePath:'/Users/mehmetsah/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const ctx = await b.newContext({viewport:VP, userAgent: process.argv[2]==='mobil'
  ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  : undefined});
const p = await ctx.newPage();
await p.goto(URL,{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(2500);

const r = await p.evaluate(()=>{
  const px = s => parseFloat(s)||0;
  const out = {lh:[], tik:[], izgara:{}, kritik:[]};
  const nodes = [...document.querySelectorAll('main *, [class*=product] *')];
  const seen = new Set();
  for (const el of nodes){
    if (seen.has(el)) continue; seen.add(el);
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (cs.display==='none' || cs.visibility==='hidden') continue;
    const txt = (el.textContent||'').trim().slice(0,40);
    const kendiMetin = [...el.childNodes].some(n=>n.nodeType===3 && n.textContent.trim());
    const sel = el.tagName.toLowerCase() + (el.className && typeof el.className==='string' ? '.'+el.className.trim().split(/\s+/).slice(0,3).join('.') : '');
    // satir yuksekligi
    if (kendiMetin && txt){
      const fs = px(cs.fontSize), lh = cs.lineHeight==='normal' ? fs*1.2 : px(cs.lineHeight);
      const oran = +(lh/fs).toFixed(3);
      if (oran < 1.3) out.lh.push({sel, txt, fs, lh, oran, lhRaw:cs.lineHeight});
    }
    // tiklanabilir
    const tiklanabilir = el.matches('a,button,[role=button],summary,label,input[type=radio],input[type=checkbox]');
    if (tiklanabilir && rect.height>2 && rect.width>2){
      const pt=px(cs.paddingTop), pb=px(cs.paddingBottom);
      if (pt<6 || pb<6) out.tik.push({sel, txt, pt, pb, h:+rect.height.toFixed(1), w:+rect.width.toFixed(1)});
    }
    // 4px izgara
    for (const prop of ['paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','rowGap','columnGap']){
      const v = px(cs[prop]);
      if (v>0 && Math.abs(v % 4) > 0.01 && Math.abs(4 - (v%4)) > 0.01){
        const k = prop+':'+(+v.toFixed(2))+'px';
        out.izgara[k] = out.izgara[k] || {adet:0, ornek:[]};
        out.izgara[k].adet++;
        if (out.izgara[k].ornek.length<3) out.izgara[k].ornek.push(sel);
      }
    }
  }
  // kritik ogeler: baslik, fiyat, breadcrumb
  const krit = [
    ['BAŞLIK', 'h1, .product-title, [class*=product-title]'],
    ['FİYAT', '.price, product-price, [class*=price-item]'],
    ['VERGİ NOTU', '[class*=tax], .product-price__tax, small'],
    ['BREADCRUMB', 'nav a, .breadcrumb a, [class*=breadcrumb] a'],
    ['SEKME/AKORDEON', 'details summary, .accordion__title, [class*=accordion] summary'],
    ['SEPETE EKLE', 'button[name=add], .product-form__submit'],
  ];
  for (const [ad, s] of krit){
    for (const el of [...document.querySelectorAll(s)].slice(0,4)){
      const cs=getComputedStyle(el), rc=el.getBoundingClientRect();
      if (cs.display==='none'||rc.height===0) continue;
      const fs=parseFloat(cs.fontSize), lh=cs.lineHeight==='normal'?fs*1.2:parseFloat(cs.lineHeight);
      out.kritik.push({ad, sel:el.tagName.toLowerCase()+'.'+(typeof el.className==='string'?el.className.trim().split(/\s+/).slice(0,2).join('.'):''),
        txt:(el.textContent||'').trim().slice(0,32), fs:+fs.toFixed(2), lh:+lh.toFixed(2), oran:+(lh/fs).toFixed(3),
        lhRaw:cs.lineHeight, fw:cs.fontWeight, ls:cs.letterSpacing, ff:cs.fontFamily.split(',')[0],
        pad:`${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
        mar:`${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
        h:+rc.height.toFixed(1), w:+rc.width.toFixed(1)});
    }
  }
  out.sayim = {lh:out.lh.length, tik:out.tik.length, izgara:Object.values(out.izgara).reduce((a,x)=>a+x.adet,0)};
  out.tasma = {scrollW:document.documentElement.scrollWidth, clientW:document.documentElement.clientWidth};
  return out;
});
console.log(JSON.stringify(r,null,1));
await b.close();
