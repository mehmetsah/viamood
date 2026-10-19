// #994753 m6 — ROZET KAPISI (negatif E2E dahil). Snippet CSS'i doğruluk kaynağıdır:
// tema-yamalari/via-urun-rozet.liquid.994753-M6-YENI içinden SÖKÜLÜR, elle kopyalanmaz
// (bu depoda "kopya = sessiz kayma" ölçülmüş arıza sınıfı).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const YAMA = readFileSync(new URL('../tema-yamalari/via-urun-rozet.liquid.994753-M6-YENI', import.meta.url), 'utf8');
const cssHam = YAMA.match(/<style>([\s\S]*?)<\/style>/)[1];
// yorumlar SÖKÜLÜR: '#994753' gibi kart numaraları hex sanılıyordu (ölçüldü, ilk koşu)
const css = cssHam.replace(/\/\*[\s\S]*?\*\//g, '');
const rozetHtml = YAMA.match(/(<div class="via-rz-kat"[\s\S]*?<\/div>)/)[1];
const IMG = 'https://cdn.shopify.com/s/files/1/1006/6021/5940/files/101_1-1.jpg?v=1778104235';

const iddia = []; const ekle = (ad, ok, not='') => { iddia.push({ad, ok, not}); };
const b = await chromium.launch({ channel: 'chrome' });

async function sahne({ g, y, rozetli }) {
  const p = await (await b.newContext({ viewport: { width: g + 40, height: y + 40 }, deviceScaleFactor: 2 })).newPage();
  await p.setContent(`<!doctype html><meta charset=utf-8>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel=stylesheet>
    <style>*{box-sizing:border-box}body{margin:20px;font-family:Inter,sans-serif}
      .urun-gorsel{position:relative;width:${g}px;height:${y}px;overflow:hidden;border-radius:4px}
      .urun-gorsel img{width:100%;height:100%;object-fit:cover;display:block}
      ${css}</style>
    <div class="urun-gorsel"><img src="${IMG}" crossorigin="anonymous" alt="">${rozetli ? rozetHtml : ''}</div>`);
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(350);
  return p;
}

// ── 1) NEGATİF: rozet YOKKEN kapsayıcı ölçüsü ve görsel kutusu DEĞİŞMEMELİ
for (const [ad, g, y] of [['masaustu', 540, 720], ['mobil', 430, 573]]) {
  const kutu = async (rozetli) => { const p = await sahne({ g, y, rozetli });
    const r = await p.evaluate(() => { const k = document.querySelector('.urun-gorsel').getBoundingClientRect();
      const i = document.querySelector('.urun-gorsel img').getBoundingClientRect();
      return { kg: Math.round(k.width), ky: Math.round(k.height), ig: Math.round(i.width), iy: Math.round(i.height),
               govdeY: Math.round(document.body.scrollHeight), yatayKaydirma: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
    await p.close(); return r; };
  const yok = await kutu(false), var_ = await kutu(true);
  ekle(`[${ad}] rozetsiz↔rozetli kapsayıcı ölçüsü AYNI`,
    yok.kg === var_.kg && yok.ky === var_.ky && yok.ig === var_.ig && yok.iy === var_.iy,
    `${yok.kg}x${yok.ky} → ${var_.kg}x${var_.ky}`);
  ekle(`[${ad}] rozet sayfa yüksekliğini İTMİYOR (akış dışı)`, yok.govdeY === var_.govdeY, `${yok.govdeY} → ${var_.govdeY}`);
  ekle(`[${ad}] yatay kaydırma YOK (taşma)`, var_.yatayKaydirma === false, String(var_.yatayKaydirma));
}

// ── 2) ROZET ÖLÇÜLERİ + nefes eşiği + taşma + ÇİFT KUTUPLU çerçeve
for (const [ad, g, y] of [['masaustu', 540, 720], ['mobil', 430, 573]]) {
  const p = await sahne({ g, y, rozetli: true });
  const o = await p.evaluate(() => {
    const n = document.querySelector('[data-via-rz]'); const r = n.getBoundingClientRect();
    const k = document.querySelector('.urun-gorsel').getBoundingClientRect();
    const st = getComputedStyle(n);
    const d = (v) => parseFloat(v);
    return { yazi: d(st.fontSize), satir: d(st.lineHeight) / d(st.fontSize),
      padY: d(st.paddingTop), padX: d(st.paddingLeft), yaricap: d(st.borderTopLeftRadius),
      golge: st.boxShadow, olaylar: getComputedStyle(document.querySelector('.via-rz-kat')).pointerEvents,
      tasma: r.right > k.right + 0.5 || r.left < k.left - 0.5 || r.top < k.top - 0.5 || r.bottom > k.bottom - 0.5,
      kaplama: +((r.width * r.height) / (k.width * k.height) * 100).toFixed(2),
      satirSayisi: [...document.querySelectorAll('[data-via-rz]')].length };
  });
  ekle(`[${ad}] yazı ≥11px`, o.yazi >= 11, `${o.yazi}px`);
  ekle(`[${ad}] satır yüksekliği ≥1.3`, o.satir >= 1.3, o.satir.toFixed(2));
  ekle(`[${ad}] dikey iç boşluk ≥6px ve 4px ızgarasında`, o.padY >= 6 && o.padY % 4 === 0, `${o.padY}px`);
  ekle(`[${ad}] yatay iç boşluk 4px ızgarasında`, o.padX % 4 === 0, `${o.padX}px`);
  ekle(`[${ad}] yarıçap = tema 4px`, o.yaricap === 4, `${o.yaricap}px`);
  ekle(`[${ad}] rozet görsel kutusundan TAŞMIYOR`, o.tasma === false, `kaplama %${o.kaplama}`);
  ekle(`[${ad}] kaplama ≤%3 (Şık A sözü: görseli örtmez)`, o.kaplama <= 3, `%${o.kaplama}`);
  ekle(`[${ad}] tek rozet — sarma riski yok`, o.satirSayisi === 1, String(o.satirSayisi));
  ekle(`[${ad}] katman tıklamayı yutmuyor (pointer-events:none)`, o.olaylar === 'none', o.olaylar);
  // ÇİFT KUTUPLU: hem beyaz saç teli hem koyu gölge aynı box-shadow'da olmalı
  const beyazHalka = /rgba?\(\s*255,\s*255,\s*255/.test(o.golge);
  const koyuGolge = /rgba?\(\s*16,\s*16,\s*24/.test(o.golge);
  ekle(`[${ad}] ÇİFT KUTUPLU çerçeve: beyaz saç teli VAR (koyu fotoğraf için)`, beyazHalka, o.golge.slice(0, 60));
  ekle(`[${ad}] ÇİFT KUTUPLU çerçeve: koyu gölge VAR (açık fotoğraf için)`, koyuGolge, '');
  await p.close();
}

// ── 3) NEGATİF KANIT: beyaz dolgulu varyant ÜRETİLMEMİŞ olmalı (Şık C'nin eleme sebebi)
ekle('negatif: snippet beyaz-dolgulu rozet varyantı İÇERMİYOR',
  !/via-rz--beyaz|background:\s*#fff[^;]*;\s*\n[^}]*--dolu/.test(css) && (css.match(/--dolu/g) || []).length > 0,
  'yalnız --dolu varyant var');
ekle('negatif: emoji YOK (ikon çizgi SVG)', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(YAMA), '');
ekle('negatif: yeni palet icat EDİLMEMİŞ (md.16) — hex yalnız ölçülmüş kargo yeşili + nötr',
  [...new Set(css.match(/#[0-9A-Fa-f]{3,6}/g) || [])].every(h => ['#fff', '#1a1a1f', '#1C6B45'].includes(h)),
  [...new Set(css.match(/#[0-9A-Fa-f]{3,6}/g) || [])].join(' '));

await b.close();
const dusen = iddia.filter(i => !i.ok);
for (const i of iddia) console.log(`${i.ok ? '✅' : '❌'} ${i.ad}${i.not ? '  — ' + i.not : ''}`);
console.log(`\n${iddia.length - dusen.length}/${iddia.length} geçti`);
process.exit(dusen.length ? 1 : 0);
