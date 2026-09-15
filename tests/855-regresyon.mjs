import { chromium } from 'playwright';
const TEMA = process.argv[2]; const q = TEMA ? `?preview_theme_id=${TEMA}` : '';
const W = Number(process.argv[3] ?? 390);
const SAYFALAR = ['/', '/collections/cok-satanlar-1', '/collections/mutfak', '/search?q=saklama'];
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:W,height:900} });
const say=(...a)=>console.log('  ',...a);
try {
  for (const yol of SAYFALAR) {
    const url = 'https://viamood.com.tr' + yol + (yol.includes('?') ? (q?'&'+q.slice(1):'') : q);
    await p.goto(url, { waitUntil:'load', timeout:60000 });
    await p.waitForTimeout(3500);
    await p.evaluate(async()=>{for(let i=0;i<4;i++){window.scrollBy(0,700);await new Promise(r=>setTimeout(r,300));}});
    await p.waitForTimeout(2000);
    const d = await p.evaluate(()=>{
      const yu=n=>Math.round(n*10)/10;
      const kartlar=[...document.querySelectorAll('article.vkol2-card')].slice(0,14);
      const ofs=[...new Set(kartlar.map(k=>{const f=k.querySelector('.vkol2-price,[class*="price"]');return f?yu(f.getBoundingClientRect().top-k.getBoundingClientRect().top):null;}).filter(v=>v!=null))];
      const tasma=kartlar.filter(k=>{const t=k.querySelector('.vkol2-title');return t&&t.scrollHeight>t.clientHeight+2;}).length;
      return { kart:kartlar.length, farkliFiyatOfs:ofs.length, ofsler:ofs.slice(0,4), basligiKirpilan:tasma };
    });
    say(`${yol.padEnd(30)} kart=${String(d.kart).padStart(2)}  farkli fiyat ofseti=${d.farkliFiyatOfs}  ${d.farkliFiyatOfs<=1?'✓':'✗'}  (kirpilan baslik: ${d.basligiKirpilan})`);
  }
} finally { await b.close(); }
