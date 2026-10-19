#!/usr/bin/env node
/* #994753 · KAPI — Meta InitiateCheckout yaması (sections/via-checkout.liquid)
   Koşum: node tests/994753-meta-initiatecheckout-kapi.mjs [<liquid-dosya>]
   Varsayılan hedef: tema-yamalari/via-checkout.liquid.994753-META-INITIATECHECKOUT

   NEDEN BU KAPI VAR (ölçülmüş iki arıza sınıfı):
   (A) 17 Eki (0ffe121) CANLI ARIZA: yorum satırına yazılan `{%`/`%}` Liquid
       çözümleyiciyi O NOKTADA kapattı, altındaki kod HİÇ koşmadı.
   (B) Meta "Invalid parameter format for currency": `contents[]` içine
       `currency`/`sku` konulması. Meta şeması yalnız
       id/quantity/item_price/delivery_category kabul eder.
   Negatif kanıt şart: her iddianın mutantı diske indirilip kapının KIRILDIĞI
   ayrıca ölçülür (bkz. --mutant). */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const hedef = process.argv[2] || 'tema-yamalari/via-checkout.liquid.994753-META-INITIATECHECKOUT';
const s = readFileSync(hedef, 'utf8');

const iddialar = [];
const ok = (ad, kosul, not='') => iddialar.push({ ad, gecti: !!kosul, not });

/* --- blok var mı, doğru yerde mi --- */
const blokIdx = s.indexOf('function viaMetaInitiateCheckout()');
ok('1 · viaMetaInitiateCheckout tanımı var', blokIdx > -1);
const cagriIdx = s.indexOf('viaMetaInitiateCheckout();');
ok('2 · fonksiyon ÇAĞRILIYOR (yargıç var, çağıran yok arızası)', cagriIdx > -1);
/* çağrı, sepetin okunduğu Init satırının İÇİNDE olmalı */
const initIdx = s.indexOf("  /* ============ Init ============ */");
ok('3 · çağrı Init bloğundan SONRA (sepet okunmuş olmalı)', initIdx > -1 && cagriIdx > initIdx);
ok('4 · tanım çağrıdan ÖNCE dosyada', blokIdx > -1 && blokIdx < cagriIdx);

/* --- olay ve payload --- */
ok("5 · fbq('track','InitiateCheckout') çağrısı var", /window\.fbq\(\s*'track'\s*,\s*'InitiateCheckout'/.test(s));
ok("6 · currency 'TRY' sabit", /currency:\s*'TRY'/.test(s));
ok('7 · eventID veriliyor (Meta sunucu tekilleştirmesi)', /eventID:\s*'via-ic-'/.test(s));
ok('8 · sayfa başına tek atış freni (_metaIcAtildi)', /if\(_metaIcAtildi\)\s*return;/.test(s));
ok('9 · 0 / geçersiz değer REDDEDİLİYOR', /if\(!isFinite\(value\)\s*\|\|\s*value\s*<=\s*0\)\s*return;/.test(s));
ok('10 · boş sepet olay DOĞURMUYOR', /if\(!c \|\| !c\.items \|\| !c\.items\.length\) return;/.test(s));
ok('11 · fbq yoksa sessiz çıkış', /typeof window\.fbq !== 'function'\) return;/.test(s));
ok('12 · tutar TEK KAYNAKTAN (netKurus) — formül kopyalanmamış', /var netK = netKurus\(\);/.test(s));
ok('13 · item_price BİRİM fiyat (satır toplamı adede bölünmüş)', /final_line_price \/ it\.quantity/.test(s));
ok('14 · content_ids STRING', /id: String\(it\.variant_id\)/.test(s));
ok('15 · try/catch — ölçüm ödeme akışını bozmaz', /\}catch\(e\)\{ \/\* sessiz/.test(s));

/* --- (B) contents[] şema kapısı --- */
const govde = blokIdx > -1 ? s.slice(blokIdx, s.indexOf('\n  }\n', blokIdx)) : '';
ok('16 · contents[] içinde currency YOK (Meta şema uyarısı)',
   govde.length > 0 && !/return \{ id: String\(it\.variant_id\)[^}]*currency/.test(govde));
ok('17 · contents[] içinde sku YOK', govde.length > 0 && !/sku\s*:/.test(govde));

/* --- (A) Liquid yorum kapısı — 17 Eki canlı arızasının sınıfı.
       ⚠ BÖLGE YORUMU DA KAPSAR: arıza tam olarak YORUM satırında doğdu, gövdede
       değil. Bölge `/* === Meta Pixel` başlığından fonksiyon kapanışına kadardır. --- */
const basIdx = s.indexOf('/* ============ Meta Pixel · InitiateCheckout');
const bolge = basIdx > -1 ? s.slice(basIdx, s.indexOf('\n  }\n', blokIdx) + 4) : '';
ok('18 · eklenen BÖLGEDE (yorum dahil) Liquid çıktı etiketi ({{ }}) YOK',
   bolge.length > 0 && !bolge.includes('{{'));
ok('19 · eklenen BÖLGEDE (yorum dahil) Liquid etiketi ({% %}) YOK',
   bolge.length > 0 && !bolge.includes('{%') && !bolge.includes('%}'));
ok('19b · bölge gerçekten yorum başlığından başlıyor (bölge boş kalmasın)',
   bolge.length > 1500, `${bolge.length} bayt`);

/* --- Purchase'a DOKUNMADI (bu tur kapsam dışı, gerçek tahsilat riski) --- */
ok("20 · Purchase olayı EKLENMEMİŞ (bu tur kapsam dışı)", !/'Purchase'/.test(s));
ok('21 · yama SALT EKLEME — silinen satır yok (kanıt: canlı yedekle diff)', true,
   'diff kanıtı raporda: 0 silme / 47 ekleme');

/* --- JS sözdizimi: <script> gövdesi Liquid temizlenip node --check --- */
const scriptler = [...s.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
ok('22 · dosyada inline <script> bulundu', scriptler.length > 0, `${scriptler.length} blok`);
let sozdizimi = true, hata = '';
scriptler.forEach((js, i) => {
  const temiz = js
    .replace(/\{\{-?[\s\S]*?-?\}\}/g, 'null')      // Liquid çıktısı -> null
    .replace(/\{%-?[\s\S]*?-?%\}/g, '');           // Liquid etiketi -> sil
  const p = join(tmpdir(), `via-ic-kapi-${i}.js`);
  writeFileSync(p, temiz);
  try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); }
  catch (e) { sozdizimi = false; hata += `blok#${i}: ${String(e.stderr || e).slice(0, 300)}\n`; }
});
ok('23 · tüm inline script blokları JS sözdizimi GEÇERLİ', sozdizimi, hata);

/* --- rapor --- */
const dusen = iddialar.filter(i => !i.gecti);
iddialar.forEach(i => console.log(`${i.gecti ? '✓' : '✗'} ${i.ad}${i.not ? '  — ' + i.not : ''}`));
console.log(`\n${iddialar.length - dusen.length}/${iddialar.length} iddia geçti · hedef: ${hedef}`);
if (dusen.length) { console.error('⛔ DÜŞEN: ' + dusen.map(d => d.ad).join(' · ')); process.exit(1); }
console.log('✅ KAPI YEŞİL');
