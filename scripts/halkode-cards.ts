/**
 * Halköde TEST ortamı — hangi kartlar tanımlı?
 *
 *   node --env-file=.env.local scripts/halkode-cards.ts
 *
 * V111 "Test işlemi için tanımlı olmayan kart" hatası, kullandığımız kartın test
 * ortamında kayıtlı OLMADIĞINI söylüyor. Bu betik aday kartların BIN'lerini
 * /api/getpos'a sorar — getpos 100 dönüyorsa o kart programı POS'a tanımlıdır.
 *
 * Kart numaraları PSP dokümanlarında açıkça yayımlanan TEST kartlarıdır; gerçek
 * kart değildir, para hareketi yoktur.
 */
import { getToken, getPos } from '../src/lib/halkode/client.ts';

const CANDIDATES: Array<{ no: string; not: string }> = [
  { no: '4155141122223339', not: 'Halköde dokümanı örneği (şu an V111 veriyor)' },
  { no: '4155650100416111', not: 'QNB Finansbank/Payfor Visa test kartı' },
  { no: '5571135571135575', not: 'Finansbank Master test kartı' },
  { no: '4022774022774026', not: 'Payfor Visa test' },
  { no: '4543600299022409', not: 'Payfor Visa test 2' },
  { no: '4508034508034509', not: 'SiPay/Akbank test' },
  { no: '5406675406675403', not: 'Master test (genel)' },
  { no: '4506347011448053', not: 'Vakıf/genel Visa test' },
  { no: '9792350000000008', not: 'Troy test' },
];

const t = await getToken();
if (!t.ok) {
  console.error('token alınamadı:', t.error);
  process.exit(1);
}
console.log(`base_url: ${process.env.HALKODE_BASE_URL}\n`);
console.log('BIN'.padEnd(8), 'sonuç'.padEnd(34), 'taksit', ' not');
console.log('─'.repeat(100));

for (const c of CANDIDATES) {
  const bin = c.no.slice(0, 6);
  const r = await getPos(bin, 22.0, t.token);
  if (r.ok) {
    const nums = r.installments.map((i) => i.installments_number).join(',');
    const prog = r.installments[0]?.card_program ?? '-';
    const scheme = r.installments[0]?.card_scheme ?? '-';
    console.log(bin.padEnd(8), `✅ TANIMLI ${prog}/${scheme}`.padEnd(34), nums.padEnd(6), ' ' + c.not);
  } else {
    console.log(bin.padEnd(8), `⛔ ${r.statusCode} ${r.error}`.slice(0, 34).padEnd(34), '-'.padEnd(6), ' ' + c.not);
  }
}
