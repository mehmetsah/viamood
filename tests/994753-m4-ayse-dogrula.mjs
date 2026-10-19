import { chromium } from 'playwright';
const EXEC='/Users/mehmetsah/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const URL='https://viamood.com.tr/products/5-adet-cekmece-ici-bicaklik-kasiklik-organizer';
const KANIT='/Users/mehmetsah/asistan/tasarim-kanit';

// ───── AYŞE ÖLÇEK ÖNERİSİ · ayse:704 — SALT SAYISAL, renk/yerleşim/font boyutu DEĞİŞMİYOR
const ONERI = `
:root{
  /* A1 · tipografi satir yuksekligi — 1.1 ⇒ optik merdiven, taban 1.30 */
  --font-h1--line-height:1.30; --font-h2--line-height:1.30; --font-h3--line-height:1.32;
  --font-h4--line-height:1.35; --font-h5--line-height:1.40; --font-h6--line-height:1.40;
  /* A2 · bosluk merdiveni — 11 bozuk basamak 4px izgarasina oturuyor (en buyuk sapma 2px) */
  --padding-3xs:0.25rem; --padding-sm:0.75rem; --padding-md:0.75rem;
  --margin-3xs:0.25rem;  --margin-2xs:0.25rem; --margin-sm:0.75rem; --margin-md:0.75rem;
  --gap-3xs:0.25rem;     --gap-2xs:0.25rem;    --gap-sm:0.75rem;    --gap-md:1rem;
  /* A3 · merdiven disi tokenlar */
  --input-padding:0.75rem 0.75rem; --input-padding-x:0.75rem; --input-padding-y:0.75rem;
  --checkbox-label-padding:8px; --checkout-button-gap:12px;
  --drawer-content-block-padding:12px; --drawer-inline-padding:24px; --drawer-padding:20px;
  --badge-rectangle-padding-inline:12px; --button-size-sm:32px;
}
/* B · bizim kendi CSS'imizdeki 1.1 ve 1.2 */
.price,.product-price,[class*=product-price__regular],[class*=price__regular],
[class*=price-item--regular],product-price .price__sale,product-price .price__regular{line-height:1.3!important}
.resource-card__vendor{line-height:1.4!important}
/* C · kendi bilesenlerimiz */
.vp-tab,.vuy-btn,.vuy-btn-solid{line-height:1.4!important}
.predictive-search-results__title,.tax-note{line-height:1.4!important}
/* C-istisna · ikon-glif dugmesi: ortalamayi satir kutusundan DEGIL flex'ten al */
.vuy-modal-close{display:grid!important;place-items:center!important;line-height:1.3!important}
/* D · tiklanabilir alan — yalniz GERCEK ihlaller (dar metin baglantisi) */
.via-breadcrumb a,.vbk-all{padding-block:8px!important}
nav.via-breadcrumb{padding-block:8px!important}
`;

const OLC = () => {
  const px = s => parseFloat(s)||0;
  const out={lh:0,tik:0,izgara:0,tikGercek:0,lhListe:[],kritik:{}};
  const nodes=[...document.querySelectorAll('main *, [class*=product] *')];
  for (const el of nodes){
    const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden') continue;
    const rect=el.getBoundingClientRect();
    const kendiMetin=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    if (kendiMetin && (el.textContent||'').trim()){
      const fs=px(cs.fontSize), lh=cs.lineHeight==='normal'?fs*1.2:px(cs.lineHeight);
      if (lh/fs < 1.3){ out.lh++; if(out.lhListe.length<8) out.lhListe.push(`${(lh/fs).toFixed(2)} ${el.tagName.toLowerCase()}.${(typeof el.className==='string'?el.className.trim().split(/\s+/)[0]:'')} "${(el.textContent||'').trim().slice(0,22)}"`); }
    }
    if (el.matches('a,button,[role=button],summary,label,input[type=radio],input[type=checkbox]') && rect.height>2 && rect.width>2){
      const pt=px(cs.paddingTop), pb=px(cs.paddingBottom);
      if (pt<6||pb<6){ out.tik++; if (rect.height<32) out.tikGercek++; }
    }
    for (const p of ['paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','rowGap','columnGap']){
      const v=px(cs[p]); if (v>0 && Math.abs(v%4)>0.01 && Math.abs(4-(v%4))>0.01) out.izgara++;
    }
  }
  const al=(ad,sel)=>{const e=document.querySelector(sel); if(!e) return; const c=getComputedStyle(e), r=e.getBoundingClientRect();
    const fs=parseFloat(c.fontSize), lh=c.lineHeight==='normal'?fs*1.2:parseFloat(c.lineHeight);
    out.kritik[ad]={fs:+fs.toFixed(1),lh:+lh.toFixed(1),oran:+(lh/fs).toFixed(2),h:+r.height.toFixed(1),pad:c.paddingTop+'/'+c.paddingBottom};};
  al('h1','h1'); al('fiyat','span.price'); al('vergi','.tax-note'); al('breadcrumb-a','.via-breadcrumb a'); al('vbk-all','.vbk-all'); al('vp-tab','.vp-tab');
  out.tasma={sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth};
  return out;
};

const sonuc={};
for (const vp of [{ad:'1440',w:1440,h:1000},{ad:'430',w:430,h:1000}]){
  const b=await chromium.launch({executablePath:EXEC});
  const ctx=await b.newContext({viewport:{width:vp.w,height:vp.h}, deviceScaleFactor:1,
    userAgent: vp.ad==='430'?'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1':undefined});
  const p=await ctx.newPage();
  await p.goto(URL,{waitUntil:'networkidle',timeout:60000}); await p.waitForTimeout(2500);
  const once=await p.evaluate(OLC);
  await p.screenshot({path:`${KANIT}/994753-m4-ONCESI-${vp.ad}-20261019.png`, clip:{x:0,y:0,width:vp.w,height:Math.min(1000,vp.h)}});
  await p.addStyleTag({content:ONERI});
  await p.waitForTimeout(900);
  const sonra=await p.evaluate(OLC);
  await p.screenshot({path:`${KANIT}/994753-m4-SONRASI-${vp.ad}-20261019.png`, clip:{x:0,y:0,width:vp.w,height:Math.min(1000,vp.h)}});
  sonuc[vp.ad]={once,sonra};
  await b.close();
}
console.log(JSON.stringify(sonuc,null,1));
