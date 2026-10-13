import { chromium } from 'playwright';
const EXE = process.env.HOME+'/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const T = [
 ['iade','https://viamood.com.tr/pages/iade-ve-teslimat','.vl-body'],
 ['mesafeli','https://viamood.com.tr/pages/mesafeli-satis-sozlesmesi','.vl-body'],
 ['kvkk','https://viamood.com.tr/pages/kvkk-aydinlatma-metni','.vl-body'],
 ['privacy','https://viamood.com.tr/policies/privacy-policy','.shopify-policy__body'],
];
const b = await chromium.launch({executablePath: EXE});
for (const vw of [1280, 768, 390]) {
  const p = await b.newPage({viewport:{width:vw,height:900}});
  console.log('### '+vw+'px');
  for (const [n,u,s] of T) {
    await p.goto(u,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(900);
    const r = await p.evaluate((s)=>{const e=document.querySelector(s); if(!e) return 'KART YOK';
      const c=getComputedStyle(e), b=e.getBoundingClientRect();
      return [c.backgroundColor, c.borderTopWidth+' '+c.borderTopStyle+' '+c.borderTopColor, c.borderTopLeftRadius,
        c.paddingTop, Math.round(b.width)+'px', 'x'+Math.round(b.left),
        'ic'+Math.round(b.width-parseFloat(c.paddingLeft)-parseFloat(c.paddingRight)-2*parseFloat(c.borderLeftWidth))].join(' | ');}, s);
    console.log(n.padEnd(9), r);
  }
  await p.close();
}
await b.close();
/* #994058 ÇİVİ — dört yasal sayfanın `.vl-body` kart ölçüleri 3 kırılımda BİREBİR aynı mı?
   Koşum: node tests/994058-vl-body-olcum.mjs
   Beklenen: her kırılımda dört satırın da aynı olması (bg · kenar · yarıçap · iç boşluk ·
   genişlik · x · iç genişlik). Bir satır sapıyorsa eşitleme bozulmuştur. */
