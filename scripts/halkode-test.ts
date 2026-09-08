/**
 * HALKÖDE Sanal POS — TEST ortamı uçtan uca doğrulama betiği.
 *
 *   npx tsx scripts/halkode-test.ts
 *
 * Ne yapar (hepsi staging'de, gerçek para YOK):
 *   1. token       → kimlik bilgileri geçerli mi
 *   2. hash        → üret + geri çöz (round-trip); PHP referansıyla aynı mı
 *   3. paySmart3D  → bankaya giden 3D HTML formu dönüyor mu
 *   4. checkstatus → 3D tamamlanmamış işlem ne diyor
 *   5. NEGATİF     → geçersiz kart · kurcalanmış hash · yanlış secret
 *
 * Sır kuralı: hiçbir anahtar DEĞERİ yazdırılmaz, yalnız uzunluk/maske.
 */

import {
  getToken,
  paySmart3D,
  checkStatus,
  generateHashKey,
  decodeHashKey,
  verifyReturnHash,
  halkodeConfigured,
  halkodeIsLive,
  buildInvoiceId,
  encryptBundle,
  getPos,
  HALKODE_STATUS,
} from '../src/lib/halkode/client.ts';

// ⚠️ Dokümandaki örnek kart (4155 1411 ...) test ortamında TANIMSIZ → banka V111 döner.
// Çalışan kart: QNB Finansbank test visa (getpos'ta 1-6 taksit tanımlı).
const TEST_CARD = '4155650100416111';
const BAD_CARD = '4111111111111111'; // red beklenen kart

function h(title: string) {
  console.log(`\n${'─'.repeat(64)}\n${title}\n${'─'.repeat(64)}`);
}
function ok(m: string) {
  console.log(`  ✓ ${m}`);
}
function no(m: string) {
  console.log(`  ✗ ${m}`);
}

async function main() {
  h('0) Yapılandırma');
  console.log(`  base_url        : ${process.env.HALKODE_BASE_URL}`);
  console.log(`  app_id          : ${process.env.HALKODE_APP_ID?.length ?? 0} karakter`);
  console.log(`  app_secret      : ${process.env.HALKODE_APP_SECRET?.length ?? 0} karakter`);
  console.log(`  merchant_key    : ${process.env.HALKODE_MERCHANT_KEY?.length ?? 0} karakter`);
  console.log(`  configured      : ${halkodeConfigured()}`);
  console.log(`  CANLI ortam mı? : ${halkodeIsLive()}`);
  if (halkodeIsLive()) {
    no('CANLI ortam tespit edildi — test betiği durduruldu.');
    process.exit(1);
  }
  if (!halkodeConfigured()) {
    no('Kimlik bilgileri eksik.');
    process.exit(1);
  }

  // ── 1) TOKEN
  h('1) POST /api/token');
  const t = await getToken();
  if (!t.ok) {
    no(`token alınamadı: ${t.error}`);
    process.exit(1);
  }
  ok(`token alındı (${t.token.length} karakter, JWT), is_3d=${t.is3d}`);
  const token = t.token;

  // ── 2) HASH round-trip
  h('2) Hash üret → çöz (round-trip)');
  const secret = process.env.HALKODE_APP_SECRET!;
  const mkey = process.env.HALKODE_MERCHANT_KEY!;
  const rtInvoice = 'RT-TEST-1';
  const hk = generateHashKey(
    { total: '22.00', installmentsNumber: 1, currencyCode: 'TRY', merchantKey: mkey, invoiceId: rtInvoice },
    secret,
  );
  console.log(`  üretilen hash formatı: iv:salt:enc → ${hk.split(':').length} parça, ${hk.length} karakter`);
  const back = decodeHashKey(hk, secret);
  if (back && back.raw.join('|') === `22.00|1|TRY|${mkey}|${rtInvoice}`) {
    ok('çözülen veri girdiyle birebir aynı (AES-256-CBC + PHP key semantiği doğru)');
  } else {
    no(`round-trip BAŞARISIZ → ${JSON.stringify(back?.raw)}`);
  }
  const wrong = decodeHashKey(hk, 'yanlis-secret-degeri');
  if (wrong === null) ok('yanlış secret ile çözülemiyor (beklenen)');
  else no(`yanlış secret ile ÇÖZÜLDÜ — güvenlik sorunu: ${JSON.stringify(wrong.raw)}`);

  // ── 2b) TAKSİT TABLOSU
  h('2b) POST /api/getpos — karta tanımlı taksitler');
  const pos = await getPos(TEST_CARD, 22.0, token);
  if (pos.ok) {
    const first = pos.installments[0];
    ok(`${pos.installments.length} seçenek · ${first?.card_program}/${first?.card_scheme} (${first?.card_type})`);
    for (const i of pos.installments) {
      console.log(`    ${String(i.installments_number).padStart(2)} taksit · taksit başı ${i.payable_amount} · toplam ${i.amount_to_be_paid} ${i.currency_code} · pos_id=${i.pos_id}`);
    }
  } else {
    no(`taksit alınamadı: ${pos.statusCode} ${pos.error}`);
  }

  // ── 3) 3D ödeme başlat
  h('3) POST /api/paySmart3D — başarı senaryosu');
  const invoiceId = buildInvoiceId(null, `t${Date.now()}`);
  console.log(`  invoice_id: ${invoiceId}`);
  const pay = await paySmart3D(
    {
      ccHolderName: 'Test Kart',
      ccNo: TEST_CARD,
      expiryMonth: '12',
      expiryYear: '2028',
      cvv: '555',
      total: 22.0,
      installmentsNumber: 1,
      invoiceId,
      name: 'Test',
      surname: 'Kullanici',
      items: [{ name: 'Test Urun', price: 22.0, quantity: 1 }],
      returnUrl: 'https://viamood.com.tr/api/v1/payment/halkode/callback',
      cancelUrl: 'https://viamood.com.tr/api/v1/payment/halkode/callback',
    },
    token,
  );
  if (pay.ok) {
    const action = /action=["']([^"']+)["']/.exec(pay.html)?.[1] ?? '(action yok)';
    const fields = [...pay.html.matchAll(/name=["']([^"']+)["']/g)].map((m) => m[1]);
    ok(`3D HTML formu döndü (${pay.html.length} bayt)`);
    console.log(`    form action: ${action}`);
    console.log(`    form alanları: ${fields.join(', ')}`);
  } else {
    no(`status_code=${pay.statusCode} — ${pay.error}`);
    if (pay.statusCode === HALKODE_STATUS.HASH_MISMATCH) no('  → 68: HASH FORMÜLÜ HATALI');
  }

  // ── 4) checkstatus
  h('4) POST /api/checkstatus (3D tamamlanmadı — beklenen: bulunamadı)');
  const st = await checkStatus(invoiceId, token);
  console.log(`  status_code=${st.statusCode} · ${st.description} · ok=${st.ok}`);
  if (st.statusCode === HALKODE_STATUS.INVALID_INVOICE || st.statusCode === HALKODE_STATUS.TRANSACTION_NOT_FOUND) {
    ok('3D tamamlanmadığı için işlem yok — doğru davranış');
  }

  // ── 5) NEGATİF senaryolar
  h('5a) NEGATİF — geçersiz/reddedilen kart');
  const bad = await paySmart3D(
    {
      ccHolderName: 'Test Kart',
      ccNo: BAD_CARD,
      expiryMonth: '12',
      expiryYear: '2028',
      cvv: '555',
      total: 22.0,
      installmentsNumber: 1,
      invoiceId: buildInvoiceId(null, `b${Date.now()}`),
      name: 'Test',
      surname: 'Kullanici',
      items: [{ name: 'Test Urun', price: 22.0, quantity: 1 }],
      returnUrl: 'https://viamood.com.tr/api/v1/payment/halkode/callback',
      cancelUrl: 'https://viamood.com.tr/api/v1/payment/halkode/callback',
    },
    token,
  );
  if (bad.ok) console.log('  → form döndü (red 3D adımında/bankada gerçekleşir)');
  else ok(`reddedildi: status_code=${bad.statusCode} — ${bad.error}`);

  h('5b) NEGATİF — dönüş imzası doğrulaması');
  // GERÇEK dönüş hash düzeni (canlı staging yanıtından ÖLÇÜLDÜ, varsayım değil):
  //   status | total | invoice_id | order_id | currency_code
  const returnHash = encryptBundle(`1|22.00|INV-9|VP123456789|TRY`, secret);
  const v1 = verifyReturnHash(returnHash, { invoiceId: 'INV-9', total: 22.0 }, secret);
  console.log(`  doğru hash + doğru tutar → ok=${v1.ok}`);
  const v2 = verifyReturnHash(returnHash, { invoiceId: 'INV-9', total: 1.0 }, secret);
  console.log(`  doğru hash + DEĞİŞTİRİLMİŞ tutar → ok=${v2.ok} (${v2.reason ?? '-'})`);
  const v3 = verifyReturnHash(returnHash, { invoiceId: 'BASKA-INV', total: 22.0 }, secret);
  console.log(`  doğru hash + BAŞKA invoice → ok=${v3.ok} (${v3.reason ?? '-'})`);
  const v4 = verifyReturnHash(returnHash.slice(0, -6) + 'AAAAAA', { invoiceId: 'INV-9', total: 22.0 }, secret);
  console.log(`  KURCALANMIŞ hash → ok=${v4.ok} (${v4.reason ?? '-'})`);
  const v5 = verifyReturnHash(returnHash, { invoiceId: 'INV-9', total: 22.0 }, 'baska-app-secret');
  console.log(`  BAŞKA secret ile üretilmiş hash → ok=${v5.ok} (${v5.reason ?? '-'})`);
  // Halköde tutarı "22" gibi de dönebiliyor (ölçüldü) — kuruş karşılaştırması bunu tolere etmeli
  const v6 = verifyReturnHash(encryptBundle(`1|22|INV-9|VP1|TRY`, secret), { invoiceId: 'INV-9', total: 22.0 }, secret);
  console.log(`  "22" vs 22.00 (kuruş normalizasyonu) → ok=${v6.ok}`);
  if (v1.ok && !v2.ok && !v3.ok && !v4.ok && !v5.ok && v6.ok) ok('imza doğrulaması 6 senaryoda da doğru davrandı');
  else no('imza doğrulaması BEKLENTİYİ KARŞILAMADI');

  h('5c) NEGATİF — geçersiz kimlik bilgisi ile token');
  const saved = process.env.HALKODE_APP_SECRET;
  const resp = await fetch(`${process.env.HALKODE_BASE_URL}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ app_id: process.env.HALKODE_APP_ID, app_secret: 'gecersiz-secret' }),
  });
  const j = (await resp.json()) as { status_code?: number; status_description?: string };
  console.log(`  status_code=${j.status_code} · ${j.status_description}`);
  if (j.status_code !== HALKODE_STATUS.SUCCESS) ok('geçersiz secret reddedildi (beklenen)');
  process.env.HALKODE_APP_SECRET = saved;

  console.log('\n✔ Test betiği tamamlandı.\n');
}

main().catch((e) => {
  console.error('HATA:', e);
  process.exit(1);
});
