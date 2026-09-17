/**
 * Halköde CANLI ortam taksit ölçümü — `getpos` kaç seçenek dönüyor?
 *
 * NEDEN AYRI BİR BETİK: canlı üye işyerinde taksit TANIMLI MI sorusunun cevabı
 * "kod doğru mu" sorusundan bağımsız. Bunu prod'a hiç dokunmadan, doğrudan
 * Halköde'ye sorarak ölçeriz; böylece 0 seçenek çıkarsa sebebi (üye işyeri
 * tanımı / tutar eşiği / kart ailesi) ayrıştırılabilir.
 *
 * Kimlikler ortam değişkenlerinden okunur; betik hiçbir sır DEĞERİ yazdırmaz.
 *
 * Çalıştırma:
 *   node --experimental-strip-types scripts/halkode-taksit-olc.ts
 */
import { getToken, getPos } from '../src/lib/halkode/client.ts';

/**
 * Denenecek BIN'ler (kartın ilk 6 hanesi). Türkiye'de yaygın kart ailelerinden
 * seçildi — amaç "hangi kartta taksit var" değil, "HERHANGİ bir kartta taksit
 * tanımı var mı" sorusunu ayrıştırmak. Taksit çıkmazsa tek bir kart ailesine
 * bakıp genelleme yapmış olmayız.
 */
const BINLER: { bin: string; ad: string }[] = [
  { bin: '415565', ad: 'QNB Finansbank CardFinans (test kartı ailesi)' },
  { bin: '492094', ad: 'Halkbank Paraf (POS bankasının kendi kartı)' },
  { bin: '540667', ad: 'Garanti Bonus' },
  { bin: '552096', ad: 'Akbank Axess' },
  { bin: '454360', ad: 'Yapı Kredi World' },
  { bin: '492180', ad: 'İş Bankası Maximum' },
  { bin: '979200', ad: 'Troy' },
];

/** Tutar eşiği hipotezini test etmek için: 10 TL çok düşük olabilir. */
const TUTARLAR = [10, 400, 1500];

async function main() {
  const base = process.env.HALKODE_BASE_URL ?? '(tanımsız)';
  console.log(`ortam: ${base}`);
  console.log(`kimlik: app_id ${process.env.HALKODE_APP_ID ? 'var' : 'YOK'} · secret ${process.env.HALKODE_APP_SECRET ? 'var' : 'YOK'} · merchant_key ${process.env.HALKODE_MERCHANT_KEY ? 'var' : 'YOK'}`);

  const t = await getToken();
  if (!t.ok) {
    console.log(`JETON ALINAMADI → ${t.error}`);
    process.exit(1);
  }
  console.log(`jeton: OK · is_3d=${t.is3d}\n`);

  for (const tutar of TUTARLAR) {
    console.log(`── tutar ${tutar.toFixed(2)} TL ───────────────────────────────`);
    for (const { bin, ad } of BINLER) {
      const r = await getPos(bin, tutar, t.token);
      if (!r.ok) {
        console.log(`  ${bin} ${ad.padEnd(46)} → HATA kod=${r.statusCode} · ${r.error}`);
        continue;
      }
      const taksitli = r.installments.filter((i) => i.installments_number > 1);
      const ozet = r.installments
        .map((i) => `${i.installments_number}x`)
        .join(',');
      console.log(
        `  ${bin} ${ad.padEnd(46)} → ${r.installments.length} seçenek` +
          ` (taksitli: ${taksitli.length})` +
          (ozet ? ` [${ozet}]` : '') +
          (r.installments[0] ? ` · ${r.installments[0].card_program} / ${r.installments[0].card_scheme}` : ''),
      );
      // Taksitli seçenek varsa komisyon farkını da göster (canlıda 0 olmamalı).
      for (const i of taksitli) {
        console.log(
          `        ${i.installments_number} taksit → toplam ${i.amount_to_be_paid} · taksit başına ${i.payable_amount}`,
        );
      }
    }
    console.log('');
  }
}

void main();
