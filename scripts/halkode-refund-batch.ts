/**
 * Halköde ÇOK KALEMLİ İADE — CANLI UYUMLU (#991465)
 *
 * ⛔ BU BETİK PARA İADE EDER. Mehmet Şah'ın açık onayı olmadan koşturulmaz.
 *
 *   kuru koşu (varsayılan — /api/refund'a TEK İSTEK BİLE gitmez):
 *       node --import ./scripts/cli-alias.mjs --env-file=.env.local scripts/halkode-refund-batch.ts
 *
 *   gerçek iade (onay geldiyse):
 *       POS_IADE_ONAY="Mehmet onayladı <tarih>" \
 *       node --import ./scripts/cli-alias.mjs --env-file=.env.local scripts/halkode-refund-batch.ts --uygula
 *
 *   ortam seçimi (varsayılan: yapılandırmanın kendi kararı):
 *       HALKODE_ORTAM=canli ...   # DB'deki canlı kimlikle app.halkode.com.tr
 *       HALKODE_ORTAM=test  ...   # testapp.halkode.com.tr
 *
 * ÇIKIŞ KODLARI (pos-iade.sh ile AYNI sözleşme):
 *   0 kuru koşu tamam / iade tamam   3 ONAY BOŞ   4 kimlik/token eksik
 *   6 ön doğrulama başarısız (hiçbir iade gönderilmedi)
 *   7 kısmi başarı — DURULDU
 *
 * ── NİYE pos-iade.sh YERİNE BU ─────────────────────────────────────────────
 * `pos-iade.sh` (bash) `/api/refund` gövdesindeki **hash_key** alanını ÜRETMİYOR.
 * `src/lib/halkode/client.ts` refund() onu şöyle üretiyor:
 *     encryptBundle([amount.toFixed(2), invoiceId, merchantKey].join('|'), appSecret)
 * (AES-256-CBC). Canlı ortamda hash_key'siz istek banka tarafından REDDEDİLİR —
 * yani "bash betiği hazır" varsayımı canlı için GEÇERSİZDİ. Bu araç client.refund()
 * çağırdığı için hash'i doğru üretir ve canlı/test ayrımını cfg() üstlenir.
 *
 * ── KORUNAN BEŞ DAVRANIŞ (pos-iade.sh'in çiviyle kanıtlanmış hâli) ─────────
 *  (a) onay değişkeni boşsa hiçbir şey yapmaz, çıkış 3 — kapı EN BAŞTA.
 *  (b) her koşuda üç referansı checkstatus ile YENİDEN doğrular; durum≠Completed
 *      VEYA tutar≠beklenen VEYA total_refunded_amount≠0 ise HİÇBİR iade
 *      göndermeden durur (çıkış 6).
 *  (c) varsayılan KURU KOŞU; gerçek çağrı yalnız --uygula ile.
 *  (d) başarı VE ret ekleme-only denetim kütüğüne yazılır.
 *  (e) kısmi başarıda DURUR: iade edilen / patlayan / denenmeyen üçlüsü, çıkış 7.
 *  (f) EK — iade sonrası YANITA DEĞİL SİSTEME bakar: checkstatus tekrar okunur,
 *      total_refunded_amount gerçekten arttı mı diye ölçülür.
 *
 * ⚠ SIR HİJYENİ: app_secret / merchant_key hiçbir yere basılmaz. Denetim kütüğüne
 *   yalnız referans, tutar, sonuç ve ortam adı yazılır.
 */
import { appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getToken, checkStatus, refund, type HalkodeOrtamSecimi } from '../src/lib/halkode/client';

// ── İADE EDİLECEK KALEMLER (#991465 · kart, toplam 30,23 TL) ────────────────
const KALEMLER: ReadonlyArray<{ ref: string; tutar: number }> = [
  { ref: 'vm0ttmu5dtwkm', tutar: 10.0 },
  { ref: 'vm0ttmuhbz16e', tutar: 10.0 },
  { ref: 'vm0ttmuhdvb0v', tutar: 10.23 },
];

const KUTUK = join(homedir(), 'asistan-veri', 'mehmet', 'POS-IADE-DENETIM.jsonl');
const KIM = 'halkode-refund-batch.ts';

// ── /api/refund ÇAĞRI SAYACI — kuru koşunun kanıtı ─────────────────────────
// Bu sayaç yalnız gerçek refund() çağrısında artar. Kuru koşuda 0 kalmalı;
// rapor bu sayıyı basar, "hiç istek gitmedi" iddiası ÖLÇÜLEBİLİR olsun diye.
let refundCagriSayisi = 0;

const ONAY = process.env.POS_IADE_ONAY ?? '';
const UYGULA = process.argv.includes('--uygula');
const ORTAM = (process.env.HALKODE_ORTAM || undefined) as HalkodeOrtamSecimi;

function kutugeYaz(olay: string, ref: string, tutar: string, sonuc: string, detay: string) {
  const satir = JSON.stringify({
    ts: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    olay, ref, tutar, sonuc, detay,
    uygula: UYGULA ? 1 : 0,
    ortam: ORTAM ?? 'varsayilan',
    kim: KIM,
  });
  appendFileSync(KUTUK, satir + '\n');          // ekleme-only; satır silinmez
}

function sayi(x: unknown): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

// ── (a) ONAY KAPISI — EN BAŞTA, her şeyden önce ────────────────────────────
// Kuru koşu bile onaysız koşmasın diye değil; onaysız GERÇEK iade koşmasın diye.
// --uygula verilmişse onay ZORUNLU.
if (UYGULA && ONAY.trim() === '') {
  console.error('⛔ ONAY BOŞ — POS_IADE_ONAY tanımlı değil. Hiçbir şey yapılmadı.');
  kutugeYaz('ret', 'coklu', '30.23', 'onay_yok', 'POS_IADE_ONAY bos');
  process.exit(3);
}

console.log(`── HALKÖDE ÇOK KALEMLİ İADE ${UYGULA ? '(GERÇEK)' : '(KURU KOŞU)'} ──`);
console.log(`   ortam: ${ORTAM ?? 'varsayılan (cfg kararı)'} · kalem: ${KALEMLER.length} · toplam: 30.23 TRY`);
if (!UYGULA) console.log('   ℹ KURU KOŞU — /api/refund çağrılmayacak.\n');

const t = await getToken(ORTAM);
if (!t.ok) {
  console.error('⛔ token alınamadı:', t.error);
  kutugeYaz('ret', 'coklu', '30.23', 'token_yok', t.error);
  process.exit(4);
}
console.log('✓ token alındı (kimlik geçerli)\n');

// ── (b) ÖN DOĞRULAMA — üçünü de checkstatus ile YENİDEN oku ────────────────
// Tek bir kalem bile şartı sağlamıyorsa HİÇBİRİ gönderilmez. "Bir kısmını
// yapalım" yok: kısmi iade, hangi paranın geri gittiğini bulanıklaştırır.
console.log('── ÖN DOĞRULAMA (salt okuma) ──');
const sapmalar: string[] = [];
for (const k of KALEMLER) {
  const s = await checkStatus(k.ref, t.token, ORTAM);
  const d = (s.data ?? {}) as Record<string, unknown>;
  const durum = String(d.transaction_status ?? '?');
  const tutar = sayi(d.transaction_amount);
  const iadeEdilmis = sayi(d.total_refunded_amount);
  console.log(
    `  ${k.ref}: durum=${durum} · tutar=${Number.isNaN(tutar) ? '?' : tutar.toFixed(2)}` +
    ` · iade edilmiş=${Number.isNaN(iadeEdilmis) ? '?' : iadeEdilmis.toFixed(2)}` +
    ` · tip=${String(d.transaction_type ?? '?')} · auth=${String(d.auth_code ?? '?')}`,
  );
  if (durum !== 'Completed') sapmalar.push(`${k.ref}: durum "${durum}" (beklenen Completed)`);
  if (Number.isNaN(tutar) || Math.abs(tutar - k.tutar) > 0.004)
    sapmalar.push(`${k.ref}: tutar ${Number.isNaN(tutar) ? '?' : tutar} (beklenen ${k.tutar})`);
  if (Number.isNaN(iadeEdilmis) || iadeEdilmis !== 0)
    sapmalar.push(`${k.ref}: total_refunded_amount ${Number.isNaN(iadeEdilmis) ? '?' : iadeEdilmis} (beklenen 0)`);
}

if (sapmalar.length > 0) {
  console.error('\n⛔ ÖN DOĞRULAMA BAŞARISIZ — HİÇBİR İADE GÖNDERİLMEDİ:');
  for (const s of sapmalar) console.error(`   · ${s}`);
  console.error(`\n   /api/refund çağrı sayısı: ${refundCagriSayisi}`);
  kutugeYaz('ret', 'coklu', '30.23', 'dogrulama_basarisiz', sapmalar.join(' | ').slice(0, 300));
  process.exit(6);
}
console.log('✓ üç kalem de doğrulandı (Completed · tutar birebir · önceki iade 0)\n');

// ── (c) KURU KOŞU KAPISI ───────────────────────────────────────────────────
if (!UYGULA) {
  console.log('── KURU KOŞU BİTTİ ──');
  console.log(`   gönderilecek olan: ${KALEMLER.map((k) => `${k.ref}=${k.tutar.toFixed(2)}`).join(' · ')}`);
  console.log(`   /api/refund çağrı sayısı: ${refundCagriSayisi}  ← 0 olmalı`);
  console.log('   gerçek iade için: POS_IADE_ONAY="..." ... --uygula');
  kutugeYaz('kuru', 'coklu', '30.23', 'kuru_kosu_tamam', 'dogrulama gecti, istek gonderilmedi');
  process.exit(0);
}

// ── GERÇEK İADE ────────────────────────────────────────────────────────────
console.log(`── GERÇEK İADE (onay: ${ONAY}) ──`);
const iadeEdilen: string[] = [];
const patlayan: string[] = [];
const denenmeyen: string[] = KALEMLER.map((k) => k.ref);

for (const k of KALEMLER) {
  denenmeyen.splice(denenmeyen.indexOf(k.ref), 1);

  refundCagriSayisi++;                                   // sayaç: gerçek çağrı
  const r = await refund(k.ref, k.tutar, t.token, ORTAM);
  console.log(`  ${k.ref}: status_code=${r.statusCode} · ${r.description}`);

  // (f) YANITA DEĞİL SİSTEME BAK — checkstatus'u tekrar oku
  await new Promise((res) => setTimeout(res, 2000));     // uç hız sınırına takılmayalım
  const sonra = await checkStatus(k.ref, t.token, ORTAM);
  const sd = (sonra.data ?? {}) as Record<string, unknown>;
  const yeniIade = sayi(sd.total_refunded_amount);
  const gercektenIslendi = !Number.isNaN(yeniIade) && Math.abs(yeniIade - k.tutar) <= 0.004;
  console.log(`     sistem: total_refunded_amount=${Number.isNaN(yeniIade) ? '?' : yeniIade.toFixed(2)}` +
    ` → ${gercektenIslendi ? '✓ işlendi' : '✗ İŞLENMEDİ'}`);

  if (r.ok && gercektenIslendi) {
    iadeEdilen.push(k.ref);
    kutugeYaz('basari', k.ref, k.tutar.toFixed(2), 'iade_islendi',
      `status_code=${r.statusCode}; sistemde total_refunded_amount=${yeniIade}`);
  } else {
    patlayan.push(k.ref);
    kutugeYaz('ret', k.ref, k.tutar.toFixed(2),
      r.ok ? 'yanit_ok_sistem_dogrulamadi' : 'iade_reddedildi',
      `status_code=${r.statusCode}; ${r.description}`.slice(0, 300));
    break;                                               // (e) kısmi başarıda DUR
  }
}

// ── (e) SONUÇ — kısmi başarıda DURULDU ─────────────────────────────────────
console.log('\n── SONUÇ ──');
console.log(`   iade edilen  (${iadeEdilen.length}): ${iadeEdilen.join(', ') || '-'}`);
console.log(`   patlayan     (${patlayan.length}): ${patlayan.join(', ') || '-'}`);
console.log(`   denenmeyen   (${denenmeyen.length}): ${denenmeyen.join(', ') || '-'}`);
console.log(`   /api/refund çağrı sayısı: ${refundCagriSayisi}`);

if (patlayan.length > 0 || denenmeyen.length > 0) {
  console.error('\n⛔ KISMİ BAŞARI — DURULDU. Kalanı elle değerlendirin.');
  process.exit(7);
}
console.log('\n✓ üç kalemin üçü de iade edildi ve sistemde doğrulandı.');
process.exit(0);
