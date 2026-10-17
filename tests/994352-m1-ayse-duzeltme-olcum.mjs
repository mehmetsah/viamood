// #994352 m1 — AYŞE DÜZELTMELERİ · CANLI ÖLÇÜM (ÇİVİ: iddialı, kırmızı yanar)
//   madde 1 · son 1 saat aciliyeti SATIR kipinde de konuşuyor mu (KAPATICI)
//   madde 3 · rakam tam kontrast, gövde soluk (iki kademeli okuma)
//   madde 4 · ŞAH kararı (md.46): >12 saat kalanda sayaç GİZLİ, yalnız gün sözü
//
// ⚠ ÖLÇÜM NEDEN ENJEKSİYONLA YAPILIYOR: kasa KİLİTLİ (kasa-kilitli-istem-yok,
//    #994324) — bu turda canlı temaya BASILAMADI; basım kontrol düzlemidir
//    (md.41/md.12), sahip kendi cihazından açar. O yüzden ölçüm, canlı ürün
//    sayfasının GERÇEK teması + GERÇEK sabit çubuğu üzerinde, dosyadan
//    ÇIKARILAN (elle kopyalanmayan) CSS/HTML/JS enjekte edilerek yapılır.
//    Basım yapıldıktan sonra `994352-vks-canli-dogrulama.mjs` ile teyit edilir.
//
// ⚠ ENJEKSİYONUN ÜÇ ZORUNLU TAKLİDİ — her biri ölçülmüş bir yanlış sonuç
//    üretmişti, o yüzden burada açıkça duruyor:
//    (a) `{%- comment -%}` blokları SİLİNİR — Liquid bunu sunucuda siler;
//        silinmezse yorum DÜZ METİN olarak satıra girer ve çubuk yüksekliğini
//        123px/211px'e şişirir (ilk ölçümde tam bu oldu, sahte "nefes" verisi).
//    (b) Canlı sayfanın KENDİ vks `<style>`/`<script>`'i KALDIRILIR — onlar
//        temanın ESKİ hâlidir ve basımda YERİ DEĞİŞTİRİLECEK, yanında
//        durmayacaktır. Kaldırılmazsa: gövdedeki eski blok head'e enjekte
//        edilen yeni kuraldan DAHA SONRA geldiği için aynı özgüllükteki
//        `.vks-satir strong{color:inherit}` kazanır ve madde 3 sahte KIRMIZI
//        yanar (ilk ölçümde tam bu oldu).
//    (c) `data-vks` → `data-vks2`: canlı betik 1 sn'lik setInterval ile zaten
//        koşuyor ve ölçüm düğümünü GERÇEK saatle ezerdi. Rename DIŞINDA hiçbir
//        şey değişmez; aşağıda geri-çevirme ile kanıtlanıyor.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const DOSYA = '/Users/mehmetsah/kod-viamood/tema-yamalari/via-kargo-sayaci.liquid.994352-SATIR-KIPI';
const kaynak = readFileSync(DOSYA, 'utf8');

const cssTam = kaynak.match(/<style>([\s\S]*?)<\/style>/)[1];
const jsTam  = kaynak.match(/<script>\s*\(function\(\)\{([\s\S]*?)\}\)\(\);\s*<\/script>/)[1];
const satirHtml = kaynak.match(/<div class="vks-satir"[\s\S]*?<\/div>/)[0]
  .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')   // (a) Liquid'in yaptığı
  .replace('data-vks ', 'data-vks2 ');                                          // (c)
const js = jsTam.replace(/\[data-vks\]/g, '[data-vks2]').replace(/__vksKurulu/g, '__vksKurulu2');

let hata = 0;
const iddia = (ad, bekl, olc) => {
  const ok = JSON.stringify(bekl) === JSON.stringify(olc);
  if (!ok) hata++;
  console.log(`   ${ok ? '✅' : '⛔'} ${ad}  bekl=${JSON.stringify(bekl)} ölç=${JSON.stringify(olc)}`);
};

// (c) kanıtı: rename geri çevrilince dosyadaki hâlin BİREBİR aynısı
if (js.replace(/\[data-vks2\]/g, '[data-vks]').replace(/__vksKurulu2/g, '__vksKurulu') !== jsTam) {
  console.error('⛔ JS enjeksiyonu rename DIŞINDA sapmış — ölçüm geçersiz'); process.exit(1);
}
console.log('0 · KAYNAK');
iddia('CSS: .vks-satir.vks--acil kuralı var (madde 1)', true, /\.vks-satir\.vks--acil\s*\{/.test(cssTam));
iddia('CSS: rakam tam kontrast (madde 3)', true, /\.vks-satir strong\{[^}]*color:rgb\(var\(--color-foreground-rgb\)\)/.test(cssTam));
iddia('HTML: data-vks-onek sarmalı var (madde 4)', true, /data-vks-onek/.test(satirHtml));
iddia('HTML: Liquid yorumu temizlendi', false, /comment/.test(satirHtml));
iddia('JS: 12 saat eşiği var (madde 4)', true, /d\.kalan > 12 \* 3600/.test(jsTam));
iddia('JS: eşik kutu kipine dokunmuyor (onekEl varlığına bağlı)', true, /!!onekEl && d\.kalan > 12 \* 3600/.test(jsTam));

const trEpoch = (gun, saat, dk) => Math.floor(Date.UTC(2026, 9, gun, saat - 3, dk, 0) / 1000); // TR=UTC+3
const SOLUK = 'rgba(0, 0, 0, 0.7)', TAM = 'rgb(0, 0, 0)', ACIL = 'rgb(212, 80, 42)';

const SENARYOLAR = [
  { ad: 'A-49saat', ts: trEpoch(17, 14,  0), not: 'Cmt 14:00, kesim 13:00 kaçtı → Pzt 15:00 = 49 saat · EŞİK ÜSTÜ',
    bekl: { onekGizli: true,  metin: 'Pazartesi kargoda', acil: false, satir: SOLUK, rakam: SOLUK, kalin: '600' } },
  { ad: 'B-6saat',  ts: trEpoch(19,  9,  0), not: 'Pzt 09:00 → bugün 15:00 = 6 saat · EŞİK ALTI',
    bekl: { onekGizli: false, metin: '5 saat 59 dk içinde sipariş verirseniz bugün kargoda', acil: false, satir: SOLUK, rakam: TAM, kalin: '600' } },
  { ad: 'C-30dk',   ts: trEpoch(19, 14, 30), not: 'Pzt 14:30 → bugün 15:00 = 30 dk · SON 1 SAAT',
    bekl: { onekGizli: false, metin: '29 dk içinde sipariş verirseniz bugün kargoda', acil: true, satir: ACIL, rakam: ACIL, kalin: '700' } },
];

const URL = 'https://via-mood.myshopify.com/products/5-adet-cekmece-ici-bicaklik-kasiklik-organizer';
const b = await chromium.launch({ channel: 'chrome' });

async function olc(cihaz, viewport, mobil) {
  console.log(`\n═══ ${cihaz} ${viewport.width}×${viewport.height} ═══`);
  for (const s of SENARYOLAR) {
    const ctx = await b.newContext({ viewport, isMobile: mobil, hasTouch: mobil,
      userAgent: mobil ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
    const p = await ctx.newPage();
    await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
    try { await p.getByRole('button', { name: /Kabul Et/i }).first().click({ timeout: 6000 }); } catch {}
    await p.waitForTimeout(600);
    const stuck = () => p.evaluate(() => document.querySelector('.sticky-add-to-cart__bar')?.dataset.stuck);
    for (let i = 0; i < 10 && (await stuck()) !== 'true'; i++) { await p.mouse.wheel(0, 1400); await p.waitForTimeout(450); }

    const kurulum = await p.evaluate(([css, html, kod, ts]) => {
      // (b) temanın ESKİ vks bloklarını kaldır — basımda yerleri değişecek
      let kaldirilan = 0;
      document.querySelectorAll('style').forEach(st => {
        if (/\.vks(-satir)?[\s.{[]/.test(st.textContent || '')) { st.remove(); kaldirilan++; }
      });
      document.querySelectorAll('[data-vks]').forEach(n => { n.removeAttribute('data-vks'); n.remove(); });
      const st = document.createElement('style'); st.textContent = css;
      document.body.appendChild(st);      // gövde sonu: temanın kendi yerine en yakın konum
      const bar = document.querySelector('.sticky-add-to-cart__bar');
      bar.insertAdjacentHTML('afterbegin', html.replace(/data-sunucu-ts="[^"]*"/, `data-sunucu-ts="${ts}"`));
      new Function(`(function(){${kod}})()`)();
      return { kaldirilanEskiStyle: kaldirilan };
    }, [cssTam, satirHtml, js, s.ts]);
    await p.waitForTimeout(1200);

    const o = await p.evaluate(() => {
      const n = document.querySelector('[data-vks2]');
      const onek = n.querySelector('[data-vks-onek]'), gun = n.querySelector('[data-vks-gun]');
      const cs = getComputedStyle(n), csG = getComputedStyle(gun);
      const r = n.getBoundingClientRect(), br = document.querySelector('.sticky-add-to-cart__bar').getBoundingClientRect();
      return {
        metin: (n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim(),
        onekGizli: onek.hasAttribute('hidden'), acil: n.classList.contains('vks--acil'),
        satir: cs.color, rakam: csG.color, kalin: csG.fontWeight,
        arkaplan: cs.backgroundColor, animasyon: cs.animationName,
        yazi: cs.fontSize, satirYuk: cs.lineHeight,
        satirY: Math.round(r.height), barY: Math.round(br.height), tasma: Math.round(r.right) > Math.round(br.right) + 1,
      };
    });

    console.log(`\n[${cihaz} · ${s.ad}] ${s.not}   (kaldırılan eski style: ${kurulum.kaldirilanEskiStyle})`);
    iddia('sarmal gizli mi', s.bekl.onekGizli, o.onekGizli);
    iddia('görünen metin', s.bekl.metin, o.metin);
    iddia('vks--acil sınıfı', s.bekl.acil, o.acil);
    iddia('satır rengi', s.bekl.satir, o.satir);
    iddia('rakam rengi', s.bekl.rakam, o.rakam);
    iddia('rakam kalınlığı', s.bekl.kalin, o.kalin);
    // Ayşe'nin açık kararı: çubukta ZEMİN ve NABIZ YOK (CTA ile yarışmasın)
    iddia('zemin yok', 'rgba(0, 0, 0, 0)', o.arkaplan);
    iddia('nabız yok', 'none', o.animasyon);
    // nefes eşiği (§8): yazı ≥11px, satır yüksekliği ≥1.3
    iddia('yazı ≥11px', true, parseFloat(o.yazi) >= 11);
    iddia('satır yüksekliği ≥1.3', true, parseFloat(o.satirYuk) / parseFloat(o.yazi) >= 1.3);
    iddia('çubuktan taşma yok', false, o.tasma);
    console.log(`   ölçü: satır ${o.satirY}px · çubuk ${o.barY}px · yazı ${o.yazi}/${o.satirYuk}`);

    await p.screenshot({ path: `/tmp/994352-m1-${cihaz}-${s.ad}.png`, clip: await p.evaluate(() => {
      const e = document.querySelector('.sticky-add-to-cart__bar').getBoundingClientRect();
      return { x: Math.max(0, e.x - 12), y: Math.max(0, e.y - 12), width: Math.min(e.width + 24, innerWidth), height: e.height + 24 };
    }) });
    await ctx.close();
  }
}

await olc('masaustu', { width: 1440, height: 900 }, false);
await olc('telefon',  { width: 430,  height: 860 }, true);
await b.close();
console.log(`\n${hata === 0 ? '✅ TÜM İDDİALAR GEÇTİ' : `⛔ ${hata} İDDİA DÜŞTÜ`}`);
process.exit(hata === 0 ? 0 : 1);
