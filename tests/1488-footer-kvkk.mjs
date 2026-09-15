/** #1488 — footer KVKK bağlantısı yeni tam metne gidiyor mu? Gerçek tıklama. */
import { chromium } from 'playwright';
const W = Number(process.argv[2] ?? 1280);
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:W,height:900} });
const say=(...a)=>console.log('  ',...a);
try{
  await p.goto('https://viamood.com.tr/',{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(3000);
  // Onune gecen katmanlari kaldir: kampanya pop-up'i (z-index 99999) + cerez bandi
  await p.evaluate(()=>{
    document.querySelectorAll('.vmk-overlay, #vm-cookie, [class*="cookie"], [id*="cookie"]').forEach(e=>e.remove());
  });
  await p.waitForTimeout(500);
  await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await p.waitForTimeout(2000);
  const link = p.locator('footer a:has-text("KVKK"), a:has-text("KVKK Aydınlatma")').first();
  const href = await link.getAttribute('href');
  const metin = (await link.textContent() ?? '').trim();
  say(`${W}px · footer bağlantısı: "${metin}" → ${href}`);
  await link.click({ timeout:20000 });
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(2500);
  const varis = await p.evaluate(()=>({
    url: location.pathname,
    baslik: document.querySelector('h1')?.textContent?.trim().slice(0,46) ?? null,
    bolum: document.querySelectorAll('h2').length,
    zorunlu: ['Hukuki Sebepleri','Saklama Süresi','Başvuru Yolu'].filter(k=>document.body.innerText.includes(k)),
  }));
  say('varılan adres :', varis.url);
  say('sayfa başlığı :', varis.baslik);
  say('h2 bölüm      :', varis.bolum);
  say('zorunlu unsur :', varis.zorunlu.join(' · '));
  say('HÜKÜM         :', varis.url === '/pages/kvkk-aydinlatma-metni' && varis.zorunlu.length === 3 ? 'DOĞRU SAYFA ✓' : 'YANLIŞ ✗');
} finally { await b.close(); }
