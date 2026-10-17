// #994352 madde 1 — sabit kutuya kargo sayacı: CANLI ölçüm + risk kanıtı + yama kanıtı
import { chromium } from 'playwright';
const URL = process.env.VM_URL || 'https://via-mood.myshopify.com/products/5-adet-cekmece-ici-bicaklik-kasiklik-organizer';
const b = await chromium.launch({ channel:'chrome' });
const p = await (await b.newContext({ viewport:{width:1440,height:900} })).newPage();
await p.goto(URL, { waitUntil:'load', timeout:60000 });

const say = () => p.evaluate(() => Array.from(document.querySelectorAll('[data-vks]')).map(n=>({
  gizli:n.hasAttribute('hidden'),
  sayac:(n.querySelector('[data-vks-sayac]')||{}).textContent,
  yer:n.closest('.sticky-add-to-cart__info')?'STICKY':'SAYFA' })));
const kutu = () => p.evaluate(()=>{ const el=document.querySelector('.sticky-add-to-cart__bar'); if(!el) return null;
  const r=el.getBoundingClientRect(); return {g:Math.round(r.width), y:Math.round(r.height), stuck:el.dataset.stuck}; });
const cek = async (ad) => { try { await p.screenshot({ path:`/tmp/994352-${ad}.png` }); return 'ok'; } catch(e){ return 'HATA '+e.message.slice(0,40); } };

console.log('A · ilk hal:', JSON.stringify(await say()));
await p.waitForTimeout(1500);
console.log('B · 1.5sn sonra (tiklıyor mu):', JSON.stringify(await say()));

// sabit kutuyu yapıştır
for (let i=0;i<8 && (await kutu())?.stuck!=='true'; i++){ await p.mouse.wheel(0, 1400); await p.waitForTimeout(500); }
console.log('C · bar ÖNCE:', JSON.stringify(await kutu()), await cek('A-bar-once'));

// ikinci kopyayı enjekte et = temaya yazılacak hâlin birebir taklidi
await p.evaluate(()=>{ const kok=document.querySelector('[data-vks]'); const info=document.querySelector('.sticky-add-to-cart__info');
  const k=kok.cloneNode(true); k.setAttribute('data-vks-sticky',''); info.appendChild(k); });
await p.waitForTimeout(2200);
console.log('D · CANLI JS ile enjeksiyon sonrası:', JSON.stringify(await say()));
console.log('E · bar SONRA:', JSON.stringify(await kutu()), await cek('B-bar-sonra-ham'));

// YAMALI JS: querySelectorAll + her tikte yeniden tara
await p.evaluate(()=>{
  var KESIM={1:15,2:15,3:15,4:15,5:15,6:13}, GUNLER=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  function trParca(ms){ var pr=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date(ms));
    var o={}; pr.forEach(function(x){o[x.type]=x.value;}); var k={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
    return {gun:k[o.weekday],saat:+o.hour,dakika:+o.minute,saniye:+o.second}; }
  function vksDurum(ms){ var t=trParca(ms), s=t.saat*3600+t.dakika*60+t.saniye, ks=KESIM[t.gun];
    if(ks!==undefined && s<ks*3600) return {kalan:ks*3600-s,bugun:true,etiket:'bugün kargoda'};
    var gs=86400-s; for(var i=1;i<=7;i++){ var g=(t.gun+i)%7; if(KESIM[g]!==undefined) return {kalan:gs+(i-1)*86400+KESIM[g]*3600,bugun:false,etiket:GUNLER[g]+' kargoda'}; } return null; }
  function sureYaz(sn){ var s=Math.floor(sn/3600),d=Math.floor((sn%3600)/60); return s>0? s+' saat '+d+' dk' : d+' dk'; }
  function sayacYaz(sn){ var s=Math.floor(sn/3600),d=Math.floor((sn%3600)/60),n=sn%60,i=function(x){return x<10?'0'+x:''+x;}; return i(s)+':'+i(d)+':'+i(n); }
  var fark=0, olculdu=false;
  function tik(){ var kokler=document.querySelectorAll('[data-vks]');
    for(var i=0;i<kokler.length;i++){ var kok=kokler[i];
      if(!olculdu){ var ts=parseInt(kok.getAttribute('data-sunucu-ts'),10); if(!isNaN(ts)){ fark=ts*1000-Date.now(); olculdu=true; } }
      var d=vksDurum(Date.now()+fark), su=kok.querySelector('[data-vks-sure]'), gu=kok.querySelector('[data-vks-gun]'), sa=kok.querySelector('[data-vks-sayac]');
      if(!d||!su||!gu||!sa){ kok.hidden=true; continue; }
      kok.hidden=false; su.textContent=sureYaz(d.kalan); gu.textContent=d.etiket; sa.textContent=sayacYaz(d.kalan);
      kok.classList.toggle('vks--acil', d.bugun && d.kalan<3600); } }
  tik(); setInterval(tik,1000);
});
await p.waitForTimeout(2200);
console.log('F · YAMALI JS ile:', JSON.stringify(await say()));
console.log('G · bar YAMALI:', JSON.stringify(await kutu()), await cek('C-bar-yamali'));
await b.close();
