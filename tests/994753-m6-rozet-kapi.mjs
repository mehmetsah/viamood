// #994753 m6 — ROZET KAPISI (tur 5 · birleşik). İKİ yama dosyası DOĞRULUK KAYNAĞIDIR:
//   tema-yamalari/via-kampanya-rozeti.liquid.994753-M6  (markup)
//   tema-yamalari/via-kampanya-rozeti.css.994753-M6     (stil)
// İçerik SÖKÜLÜR, elle kopyalanmaz (bu depoda "kopya = sessiz kayma" ölçülmüş arıza sınıfı).
//
// TUR 3-4'ÜN KÖK NEDENİ BU ÇİVİNİN ASIL KONUSU: `object-fit:contain` altında
// <img> ELEMAN kutusu ile EKRANDA BOYANAN görsel aynı şey değildir. Eski çivi
// yalnız eleman kutusuna göre ölçüyordu ve 6/6 YEŞİL verirken rozet fotoğrafın
// 18px solunda, beyaz zemindeydi. §4 bölümü tam olarak bunu ölçer + NEGATİF kanıtı var.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const LIQ = readFileSync(new URL('../tema-yamalari/via-kampanya-rozeti.liquid.994753-M6', import.meta.url), 'utf8');
const CSSHAM = readFileSync(new URL('../tema-yamalari/via-kampanya-rozeti.css.994753-M6', import.meta.url), 'utf8');
// yorumlar SÖKÜLÜR: '#994753' gibi kart numaraları hex sanılıyordu (ölçüldü, ilk koşu)
const css = CSSHAM.replace(/\/\*[\s\S]*?\*\//g, '');
// Liquid gövdesi → HTML: {%- if -%} kabuğunun içi alınır, Liquid ifadeleri değerlenir.
const govde = LIQ.match(/\{%-\s*if vkr_goster\s*-%\}([\s\S]*?)\{%-\s*endif\s*-%\}/)[1];
const rozetHtml = (g, y) => govde
  .replace(/\{%-\s*comment\s*-%\}[\s\S]*?\{%-\s*endcomment\s*-%\}/g, '')
  .replace(/\{\{\s*vkr_g\s*\}\}/g, g).replace(/\{\{\s*vkr_y\s*\}\}/g, y).trim();

const iddia = []; const ekle = (ad, ok, not = '') => iddia.push({ ad, ok, not });
const b = await chromium.launch({ channel: 'chrome' });

// Gerçek ürün fotoğrafı (canlı CDN) — doğal 1015x1524, sol üst köşesi KOYU granit.
const IMG = 'https://cdn.shopify.com/s/files/1/1006/6021/5940/files/101_1-1.jpg?v=1778104235';

async function sahne({ g, y, dg, dy, rozetli, fit = 'contain', src = null, stilEk = '', mobil = false, olcerSil = false }) {
  // ⚠ ÖLÇÜLDÜ: viewport 749px altında kalırsa mobil kuralı (margin:8px) devreye girer ve
  //    masaüstü iddiaları sahte kırmızı yanar. Masaüstü sahnesi ZORLA ≥1200px açılır.
  //    Mobilde body kenar boşluğu (2x20px) viewport'a EKLENİR; yoksa sahte "yatay taşma" çıkar.
  const vpG = mobil ? g + 40 : Math.max(g + 80, 1200);
  const p = await (await b.newContext({ viewport: { width: vpG, height: y + 80 }, deviceScaleFactor: 2 })).newPage();
  const gorsel = src || `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dg}" height="${dy}"><rect width="100%" height="100%" fill="#2b2b33"/></svg>`)}`;
  await p.setContent(`<!doctype html><meta charset=utf-8>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel=stylesheet>
    <style>*{box-sizing:border-box}body{margin:20px;font-family:Inter,sans-serif}
      .product-media-constraint-wrapper{width:${g}px;height:${y}px;overflow:hidden;border-radius:4px}
      .product-media-constraint-wrapper > img{width:100%;height:100%;object-fit:${fit};display:block}
      ${css}${stilEk}</style>
    <div class="product-media-constraint-wrapper">${rozetli ? rozetHtml(dg, dy) : ''}<img src="${gorsel}" crossorigin="anonymous" alt=""></div>`);
  if (olcerSil) { await p.evaluate(() => document.querySelector('.vkr__ol')?.remove()); }
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(300);
  return p;
}

// ── 1) NEGATİF: rozet YOKKEN kapsayıcı ve görsel kutusu DEĞİŞMEMELİ (akış dışı)
for (const [ad, g, y] of [['masaustu', 540, 720], ['mobil', 430, 573]]) {
  const kutu = async (rozetli) => {
    const p = await sahne({ g, y, dg: 1015, dy: 1524, rozetli, mobil: ad === 'mobil' });
    const r = await p.evaluate(() => {
      const k = document.querySelector('.product-media-constraint-wrapper').getBoundingClientRect();
      const i = document.querySelector('.product-media-constraint-wrapper > img').getBoundingClientRect();
      return { kg: Math.round(k.width), ky: Math.round(k.height), ig: Math.round(i.width), iy: Math.round(i.height),
        govdeY: Math.round(document.body.scrollHeight),
        yatayKaydirma: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    await p.close(); return r;
  };
  const yok = await kutu(false), var_ = await kutu(true);
  ekle(`[${ad}] rozetsiz↔rozetli kapsayıcı ölçüsü AYNI`,
    yok.kg === var_.kg && yok.ky === var_.ky && yok.ig === var_.ig && yok.iy === var_.iy,
    `${yok.kg}x${yok.ky}/${yok.ig}x${yok.iy} → ${var_.kg}x${var_.ky}/${var_.ig}x${var_.iy}`);
  ekle(`[${ad}] rozet sayfa yüksekliğini İTMİYOR (akış dışı)`, yok.govdeY === var_.govdeY, `${yok.govdeY} → ${var_.govdeY}`);
  ekle(`[${ad}] yatay kaydırma YOK (taşma)`, var_.yatayKaydirma === false, String(var_.yatayKaydirma));
}

// ── 2) ROZET ÖLÇÜLERİ + nefes eşiği + taşma + ÇİFT KUTUPLU çerçeve
for (const [ad, g, y] of [['masaustu', 540, 720], ['mobil', 430, 573]]) {
  const p = await sahne({ g, y, dg: 1015, dy: 1524, rozetli: true, mobil: ad === 'mobil' });
  const o = await p.evaluate(() => {
    const n = document.querySelector('[data-vkr-rozet]'); const r = n.getBoundingClientRect();
    const k = document.querySelector('.product-media-constraint-wrapper').getBoundingClientRect();
    const st = getComputedStyle(n); const d = (v) => parseFloat(v);
    return { yazi: d(st.fontSize), satir: d(st.lineHeight) / d(st.fontSize),
      padY: d(st.paddingTop), padX: d(st.paddingLeft), yaricap: d(st.borderTopLeftRadius),
      golge: st.boxShadow, olaylar: getComputedStyle(document.querySelector('.vkr')).pointerEvents,
      tasma: r.right > k.right + 0.5 || r.left < k.left - 0.5 || r.top < k.top - 0.5 || r.bottom > k.bottom - 0.5,
      kaplama: +((r.width * r.height) / (k.width * k.height) * 100).toFixed(2),
      rozetSayisi: document.querySelectorAll('[data-vkr-rozet]').length };
  });
  ekle(`[${ad}] yazı ≥11px`, o.yazi >= 11, `${o.yazi}px`);
  ekle(`[${ad}] satır yüksekliği ≥1.3`, o.satir >= 1.3, o.satir.toFixed(2));
  ekle(`[${ad}] dikey iç boşluk ≥6px ve 4px ızgarasında`, o.padY >= 6 && o.padY % 4 === 0, `${o.padY}px`);
  ekle(`[${ad}] yatay iç boşluk 4px ızgarasında`, o.padX % 4 === 0, `${o.padX}px`);
  ekle(`[${ad}] yarıçap = tema 4px`, o.yaricap === 4, `${o.yaricap}px`);
  ekle(`[${ad}] rozet görsel kutusundan TAŞMIYOR`, o.tasma === false, `kaplama %${o.kaplama}`);
  ekle(`[${ad}] kaplama ≤%3 (Şık A sözü: görseli örtmez)`, o.kaplama <= 3, `%${o.kaplama}`);
  ekle(`[${ad}] tek rozet — sarma riski yok`, o.rozetSayisi === 1, String(o.rozetSayisi));
  ekle(`[${ad}] katman tıklamayı yutmuyor (pointer-events:none)`, o.olaylar === 'none', o.olaylar);
  const beyazHalka = /rgba?\(\s*255,\s*255,\s*255/.test(o.golge);
  const koyuGolge = /rgba?\(\s*16,\s*16,\s*24/.test(o.golge);
  ekle(`[${ad}] ÇİFT KUTUPLU çerçeve: beyaz saç teli VAR (koyu fotoğraf için)`, beyazHalka, o.golge.slice(0, 48));
  ekle(`[${ad}] ÇİFT KUTUPLU çerçeve: koyu gölge VAR (açık fotoğraf için)`, koyuGolge, '');
  await p.close();
}

// ── 3) NEGATİF KANIT: elenen varyantlar / kaçak desenler ÜRETİLMEMİŞ olmalı
ekle('negatif: beyaz-dolgulu rozet varyantı İÇERMİYOR (Şık C eleme sebebi)',
  !/vkr__rozet--beyaz|via-rz--beyaz/.test(css), '');
// Tarama EKRANA ÇIKAN markup + stil üzerinde yapılır; belge yorumlarındaki ⚠/⛔
// işaretleri ürüne girmez (ilk sürüm tüm dosyayı tarıyordu, sahte kırmızı veriyordu).
ekle('negatif: emoji YOK (ikon çizgi SVG)',
  !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(rozetHtml(1, 1) + css), '');
ekle('negatif: yeni palet icat EDİLMEMİŞ (md.16) — yalnız ölçülmüş kargo yeşili + nötr',
  [...new Set(css.match(/#[0-9A-Fa-f]{3,6}/g) || [])].every(h => ['#fff', '#1C6B45'].includes(h)),
  [...new Set(css.match(/#[0-9A-Fa-f]{3,6}/g) || [])].join(' '));
ekle('negatif: ölçer SVG ağa istek ATMIYOR (src/href YOK)',
  !/class="vkr__ol"[^>]*(src|href|xlink)/.test(govde), '');
ekle('negatif: ölçer gizlenirken display:none / width:0 KULLANILMIYOR (göz çökerdi)',
  !/\.vkr__ol[^}]*(display:\s*none|width:\s*0)/.test(css), '');

// ── 4) ASIL KAPI · BOYANAN GÖRSEL GEOMETRİSİ (tur 3-4'ün kaçırdığı sınıf)
//     Rozetin solu/üstü, EKRANDA BOYANAN fotoğrafın sol/üstünden tam 12px (mobil 8px) içeride.
const senaryo = [
  { ad: 'T4 gerçeği 540x720 · foto 1015x1524', g: 540, y: 720, dg: 1015, dy: 1524, bek: 12 },
  { ad: 'yatay foto 1600x900 · 540x720',       g: 540, y: 720, dg: 1600, dy: 900,  bek: 12 },
  { ad: 'kare foto 1000x1000 · 540x720',       g: 540, y: 720, dg: 1000, dy: 1000, bek: 12 },
  { ad: 'dikey foto · kare kutu 600x600',      g: 600, y: 600, dg: 1015, dy: 1524, bek: 12 },
  { ad: 'MOBİL 390x520 · foto 1015x1524',      g: 390, y: 520, dg: 1015, dy: 1524, bek: 8, mobil: true },
  { ad: 'çok yatay 2000x600 · 430x430',        g: 430, y: 430, dg: 2000, dy: 600,  bek: 8, mobil: true },
];
const girintiOlc = async (s, stilEk = '', olcerSil = false) => {
  const p = await sahne({ ...s, rozetli: true, fit: 'contain', stilEk, mobil: !!s.mobil, olcerSil });
  const r = await p.evaluate(() => {
    const im = document.querySelector('.product-media-constraint-wrapper > img');
    const kb = document.querySelector('.product-media-constraint-wrapper').getBoundingClientRect();
    const o = im.naturalWidth / im.naturalHeight;
    const bw = Math.min(kb.width, kb.height * o), bh = bw / o;      // contain matematiği
    const boyanan = { sol: kb.left + (kb.width - bw) / 2, ust: kb.top + (kb.height - bh) / 2 };
    const rz = document.querySelector('[data-vkr-rozet]').getBoundingClientRect();
    return { dx: rz.left - boyanan.sol, dy: rz.top - boyanan.ust };
  });
  await p.close(); return r;
};
for (const s of senaryo) {
  const r = await girintiOlc(s);
  ekle(`[boyanan] ${s.ad} — rozet SOLU fotoğrafın solundan ${s.bek}px içeride`,
    Math.abs(r.dx - s.bek) <= 1, `ölçülen ${r.dx.toFixed(1)}px`);
  ekle(`[boyanan] ${s.ad} — rozet ÜSTÜ fotoğrafın üstünden ${s.bek}px içeride`,
    Math.abs(r.dy - s.bek) <= 1, `ölçülen ${r.dy.toFixed(1)}px`);
}
// ── 4a) KAPSAM SINIRI, VARSAYIM DEĞİL: bu mağazanın galerisi `object-fit: contain`
//     ile boyuyor (base.css:1587 `.product-media-container img{object-fit:contain}`;
//     ölçüldü canlı DOM'da, T4). Ölçer katmanı `contain` matematiğini kurar.
//     `cover` yolunda kutu = boyanan olduğundan ölçer gereksizdir ve rozeti ~30px fazla
//     içeri iter — bu KAPSAM DIŞIDIR. Tema ayarı ileride `cover`a çevrilirse sessizce
//     kaymasın diye E2E'de CANLI DOM üstünde tripwire var (objectFit === 'contain').
//     ⛔ `@container style(--product-media-fit: cover)` ile otomatik geçiş BİLEREK
//     denenmedi: o değişken galeride `.media-fit-cover` sınıfına yazılıyor ama gerçekte
//     boyayan kural base.css'teki contain — değişken GERÇEĞİ YANSITMIYOR, ona güvenen
//     bir guard şu an DOĞRU olan hâli bozardı.
{
  const p = await sahne({ g: 540, y: 720, dg: 1015, dy: 1524, rozetli: true, fit: 'cover' });
  const r = await p.evaluate(() => {
    const kb = document.querySelector('.product-media-constraint-wrapper').getBoundingClientRect();
    const rz = document.querySelector('[data-vkr-rozet]').getBoundingClientRect();
    return { dx: rz.left - kb.left };
  });
  await p.close();
  ekle('[kapsam] cover yolunda sapma OLUŞUR — bilinen sınır, E2E tripwire ile korunuyor',
    r.dx > 13, `cover'da girinti ${r.dx.toFixed(1)}px (contain'de 12.0) — tema contain'de kalmalı`);
}
// ── 4b) NEGATİF KANIT: ölçer katmanı etkisizleşirse §4 KIRILMALI.
//        (Çivinin gerçekten ısırdığının kanıtı — tur 3-4'te eksik olan tam buydu.)
{
  const silinmis = await girintiOlc(senaryo[0], '', true);
  ekle('NEGATİF-a: ölçer elemanı SİLİNİNCE §4 kırılıyor (çivi ısırıyor)',
    Math.abs(silinmis.dx - 12) > 1, `ölçersiz girinti ${silinmis.dx.toFixed(1)}px (sağlamda 12.0)`);
  const gizli = await girintiOlc(senaryo[0], ' .vkr__ol{display:none!important}');
  ekle('NEGATİF-b: ölçer display:none olunca §4 kırılıyor',
    Math.abs(gizli.dx - 12) > 1, `gizli ölçerde girinti ${gizli.dx.toFixed(1)}px (sağlamda 12.0)`);
}

// ── 5) GERÇEK FOTOĞRAF · koyu köşede kontrast (ŞAH ölçümü 1.51 → çift kutuplu çerçeve)
{
  const p = await sahne({ g: 540, y: 720, dg: 1015, dy: 1524, rozetli: true, fit: 'contain', src: IMG });
  const o = await p.evaluate(() => {
    const n = document.querySelector('[data-vkr-rozet]'); const st = getComputedStyle(n);
    return { golge: st.boxShadow, zemin: st.backgroundColor, yazi: st.color };
  });
  ekle('[gerçek foto] rozet koyu granit köşede de ÇİFT KUTUPLU çerçeveyle geliyor',
    /255,\s*255,\s*255/.test(o.golge) && /16,\s*16,\s*24/.test(o.golge), o.golge.slice(0, 56));
  ekle('[gerçek foto] zemin/yazı kontrastı ≥4.5 (beyaz üstü #1C6B45)', (() => {
    const L = (c) => { const [r, g, bl] = c.match(/\d+/g).slice(0, 3).map(Number).map(v => {
      const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
    const a = L(o.zemin), bq = L(o.yazi);
    return (Math.max(a, bq) + 0.05) / (Math.min(a, bq) + 0.05) >= 4.5;
  })(), `${o.zemin} / ${o.yazi}`);
  await p.close();
}

await b.close();
const dusen = iddia.filter(i => !i.ok);
for (const i of iddia) console.log(`${i.ok ? '✅' : '❌'} ${i.ad}${i.not ? '  — ' + i.not : ''}`);
console.log(`\n${iddia.length - dusen.length}/${iddia.length} geçti`);
process.exit(dusen.length ? 1 : 0);
