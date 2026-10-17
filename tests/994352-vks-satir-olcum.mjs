// #994352 madde 1 — "satır kipi" sabit çubukta ÖLÇÜM (yazmadan önce)
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const yeni = readFileSync('/tmp/yeni-snippets__via-kargo-sayaci.liquid','utf8');
const css = yeni.match(/\/\* SATIR KİPİ[\s\S]*?\.vks-satir strong\{[^}]*\}/)[0];
const satirHtml = yeni.match(/<div class="vks-satir"[\s\S]*?<\/div>/)[0].replace(/\{\{[^}]*\}\}/, String(Math.floor(Date.now()/1000)));
const URL = 'https://via-mood.myshopify.com/products/5-adet-cekmece-ici-bicaklik-kasiklik-organizer';
const b = await chromium.launch({ channel:'chrome' });
const p = await (await b.newContext({ viewport:{width:1440,height:900} })).newPage();
await p.goto(URL,{waitUntil:'load',timeout:60000});
// çerez şeridi sabit çubuğun önünü kapatıyor — kabul edip kaldır
try { await p.getByRole('button',{name:/Kabul Et/i}).first().click({timeout:5000}); } catch(e){ console.log('çerez şeridi yok/kapanmadı'); }
await p.waitForTimeout(600);
const kutu = () => p.evaluate(()=>{const el=document.querySelector('.sticky-add-to-cart__bar');const r=el.getBoundingClientRect();
  return {g:Math.round(r.width),y:Math.round(r.height),stuck:el.dataset.stuck};});
const say = () => p.evaluate(()=>Array.from(document.querySelectorAll('[data-vks]')).map(n=>({
  gizli:n.hasAttribute('hidden'), kip:n.getAttribute('data-vks-kip')||'kutu',
  yer:n.closest('.sticky-add-to-cart__info')?'STICKY':'SAYFA',
  metin:(n.textContent||'').replace(/\s+/g,' ').trim().slice(0,70)})));
for(let i=0;i<8 && (await kutu()).stuck!=='true'; i++){ await p.mouse.wheel(0,1400); await p.waitForTimeout(500); }
console.log('1 · bar ÖNCE:', JSON.stringify(await kutu()));
await p.evaluate(([css,html])=>{
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  document.querySelector('.sticky-add-to-cart__info').insertAdjacentHTML('beforeend', html);
},[css,satirHtml]);
// yamalı JS (temaya girecek hâl): her tikte TÜM düğümler
await p.evaluate(()=>{
  var KESIM={1:15,2:15,3:15,4:15,5:15,6:13}, GUNLER=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  function trParca(ms){var pr=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date(ms));
    var o={};pr.forEach(x=>o[x.type]=x.value);var k={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};return{gun:k[o.weekday],saat:+o.hour,dakika:+o.minute,saniye:+o.second};}
  function vksDurum(ms){var t=trParca(ms),s=t.saat*3600+t.dakika*60+t.saniye,ks=KESIM[t.gun];
    if(ks!==undefined&&s<ks*3600)return{kalan:ks*3600-s,bugun:true,etiket:'bugün kargoda'};
    var gs=86400-s;for(var i=1;i<=7;i++){var g=(t.gun+i)%7;if(KESIM[g]!==undefined)return{kalan:gs+(i-1)*86400+KESIM[g]*3600,bugun:false,etiket:GUNLER[g]+' kargoda'};}return null;}
  function sureYaz(sn){var s=Math.floor(sn/3600),d=Math.floor((sn%3600)/60);return s>0?s+' saat '+d+' dk':d+' dk';}
  function sayacYaz(sn){var s=Math.floor(sn/3600),d=Math.floor((sn%3600)/60),n=sn%60,i=x=>x<10?'0'+x:''+x;return i(s)+':'+i(d)+':'+i(n);}
  var fark=0,olculdu=false;
  function tik(){var kokler=document.querySelectorAll('[data-vks]');
    for(var i=0;i<kokler.length;i++){var kok=kokler[i];
      if(!olculdu){var ts=parseInt(kok.getAttribute('data-sunucu-ts'),10);if(!isNaN(ts)){fark=ts*1000-Date.now();olculdu=true;}}
      var d=vksDurum(Date.now()+fark);if(!d){kok.hidden=true;continue;}
      var su=kok.querySelector('[data-vks-sure]'),gu=kok.querySelector('[data-vks-gun]'),sa=kok.querySelector('[data-vks-sayac]');
      kok.hidden=false; if(su)su.textContent=sureYaz(d.kalan); if(gu)gu.textContent=d.etiket; if(sa)sa.textContent=sayacYaz(d.kalan);
      kok.classList.toggle('vks--acil',d.bugun&&d.kalan<3600);}}
  tik(); setInterval(tik,1000);
});
await p.waitForTimeout(1500);
console.log('2 · düğümler:', JSON.stringify(await say(),null,0));
console.log('3 · bar SONRA (satır kipi):', JSON.stringify(await kutu()));
const r = await p.evaluate(()=>{const e=document.querySelector('.sticky-add-to-cart__bar').getBoundingClientRect();return{x:Math.max(0,e.x-14),y:Math.max(0,e.y-14),width:e.width+28,height:e.height+28};});
await p.screenshot({path:'/tmp/994352-satir-kipi-bar.png', clip:r});
await p.screenshot({path:'/tmp/994352-satir-kipi-tam.png'});
await b.close();
