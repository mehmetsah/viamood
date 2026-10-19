// #994753 m6 — ŞAH bağımsız ölçümü: üç şık GERÇEK kutu boyutunda (540x720 masaüstü, 430 mobil)
// Ayşe 272px önizleme kartında ölçtü; gerçek ürün görseli kutusu 540x720. Sarma ve kaplama
// oranı kutu genişliğine bağlı olduğu için o ölçüm gerçek yüzeyi temsil ETMİYOR.
import { chromium } from 'playwright';

const ROZET = `
*{box-sizing:border-box}
body{margin:0;font-family:Inter,-apple-system,sans-serif}
.sahne{position:relative;overflow:hidden;background:#EFEFF2;border-radius:4px}
.sahne img{width:100%;height:100%;object-fit:cover;display:block}
.rz{display:inline-flex;align-items:center;gap:8px;font-size:11px;line-height:1.35;
  font-weight:600;letter-spacing:.01em;padding:8px 12px;border-radius:4px;
  background:#fff;color:var(--rk,#1a1a1f);
  box-shadow:0 1px 2px rgba(16,16,24,.14),0 0 0 1px rgba(16,16,24,.06);white-space:nowrap}
.rz svg{width:13px;height:13px;flex:0 0 auto;display:block}
.rz--dolu{background:var(--rk);color:#fff;box-shadow:0 1px 3px rgba(16,16,24,.22)}
.a-kat{position:absolute;top:12px;left:12px}
.b-kat{position:absolute;left:0;right:0;bottom:0;padding:12px;display:flex;gap:8px;flex-wrap:wrap;
  background:linear-gradient(to top,rgba(255,255,255,.96) 62%,rgba(255,255,255,0))}
.c-kat{position:absolute;top:12px;left:12px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
`;
const IMG='https://cdn.shopify.com/s/files/1/1006/6021/5940/files/101_1-1.jpg?v=1778104235';
const ikon=(d)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const KAMYON=ikon('<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18.5" r="1.6"/><circle cx="17.5" cy="18.5" r="1.6"/>');
const SAAT=ikon('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>');
const IADE=ikon('<path d="M4 12a8 8 0 1 1 2.5 5.8"/><path d="M4 7.5V12h4.5"/>');
const KART=ikon('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19"/>');

const KAT={
  A:`<div class="a-kat"><span class="rz rz--dolu" style="--rk:#1C6B45" data-rz>${KAMYON}Kargo Ücretsiz</span></div>`,
  B:`<div class="b-kat"><span class="rz" style="--rk:#1C6B45" data-rz>${KAMYON}Kargo Ücretsiz</span>
     <span class="rz" style="--rk:#1B4F8A" data-rz>${SAAT}24 saatte kargoda</span>
     <span class="rz" style="--rk:#8A5A1B" data-rz>${IADE}14 gün iade</span>
     <span class="rz" style="--rk:#4B3A8A" data-rz>${KART}Kapıda Ödeme</span></div>`,
  C:`<div class="c-kat"><span class="rz rz--dolu" style="--rk:#1C6B45" data-rz>${KAMYON}Kargo Ücretsiz</span>
     <span class="rz" style="--rk:#1B4F8A" data-rz>${SAAT}24 saatte kargoda</span></div>`,
};

const b = await chromium.launch({channel:'chrome'});
const sonuc = [];
for (const [ad, g, y] of [['masaustu',540,720], ['mobil',430,573]]) {
  for (const sik of ['A','B','C']) {
    const p = await (await b.newContext({viewport:{width:g+40,height:y+80}, deviceScaleFactor:2})).newPage();
    await p.setContent(`<!doctype html><meta charset=utf-8>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel=stylesheet>
      <style>${ROZET}</style>
      <div class="sahne" style="width:${g}px;height:${y}px"><img src="${IMG}" crossorigin="anonymous" alt="">${KAT[sik]}</div>`);
    await p.waitForLoadState('networkidle'); await p.waitForTimeout(400);

    const o = await p.evaluate(({g,y}) => {
      const rzl = [...document.querySelectorAll('[data-rz]')].map(n=>n.getBoundingClientRect());
      const sahne = document.querySelector('.sahne').getBoundingClientRect();
      const kat = document.querySelector('.a-kat,.b-kat,.c-kat').getBoundingClientRect();
      // kaç ayrı satıra sarıldı (üst kenar yuvarlanarak)
      const satirlar = [...new Set(rzl.map(r=>Math.round(r.top)))].length;
      // rozet katmanının kapladığı alan (perde dahil)
      const kaplama = (kat.width*kat.height)/(sahne.width*sahne.height)*100;
      // salt rozetlerin kapladığı alan
      const rozetAlan = rzl.reduce((a,r)=>a+r.width*r.height,0)/(sahne.width*sahne.height)*100;
      const tasma = rzl.some(r => r.right > sahne.right+0.5 || r.left < sahne.left-0.5
                               || r.bottom > sahne.bottom+0.5 || r.top < sahne.top-0.5);
      return {satirlar, rozetSayisi:rzl.length,
        katmanKaplama:+kaplama.toFixed(2), rozetKaplama:+rozetAlan.toFixed(2), tasma,
        rozetYuksekligi:Math.round(rzl[0].height),
        enGenisRozet:Math.round(Math.max(...rzl.map(r=>r.width))),
        kutuGenisligi:Math.round(sahne.width)};
    }, {g,y});

    // KONTRAST: her rozetin ALTINDAKİ fotoğraf pikselini ölç (rozeti gizleyip aynı noktaya bak)
    const kontrast = await p.evaluate(async () => {
      const kanvas = document.createElement('canvas');
      const img = document.querySelector('.sahne img');
      const sahne = document.querySelector('.sahne').getBoundingClientRect();
      kanvas.width = img.naturalWidth; kanvas.height = img.naturalHeight;
      kanvas.getContext('2d').drawImage(img,0,0);
      const ctx = kanvas.getContext('2d');
      // object-fit:cover eşlemesi
      const olc = Math.max(sahne.width/img.naturalWidth, sahne.height/img.naturalHeight);
      const kx = (img.naturalWidth*olc - sahne.width)/2, ky = (img.naturalHeight*olc - sahne.height)/2;
      const lum = (r,g,b) => { const f=c=>{c/=255; return c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4;};
        return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
      const oran = (L1,L2) => (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
      return [...document.querySelectorAll('[data-rz]')].map(n => {
        const r = n.getBoundingClientRect();
        // rozetin ARKASINDAKİ fotoğraf: rozet dikdörtgeninin 9 noktasını örnekle
        let toplam=0, n9=0;
        for (const fx of [0.1,0.5,0.9]) for (const fy of [0.1,0.5,0.9]) {
          const sx = Math.round(((r.left-sahne.left)+r.width*fx + kx)/olc);
          const sy = Math.round(((r.top-sahne.top)+r.height*fy + ky)/olc);
          if (sx<0||sy<0||sx>=kanvas.width||sy>=kanvas.height) continue;
          const d = ctx.getImageData(sx,sy,1,1).data;
          toplam += lum(d[0],d[1],d[2]); n9++;
        }
        const Lfoto = toplam/Math.max(n9,1);
        const st = getComputedStyle(n);
        const m = st.backgroundColor.match(/\d+/g).map(Number);
        const Lrozet = lum(m[0],m[1],m[2]);
        const my = st.color.match(/\d+/g).map(Number);
        return { metin:n.textContent.trim().slice(0,22),
          zemin: st.backgroundColor,
          rozetFotoKontrast: +oran(Lrozet,Lfoto).toFixed(2),   // rozet KENARI fotoğraftan ayrışıyor mu
          metinZeminKontrast: +oran(lum(my[0],my[1],my[2]),Lrozet).toFixed(2) }; // okunabilirlik
      });
    });
    await p.screenshot({path:`/tmp/994753-m6-SAH-${ad}-${sik}.png`});
    sonuc.push({sik, kip:ad, ...o, kontrast});
    await p.close();
  }
}
await b.close();
console.log(JSON.stringify(sonuc,null,1));
