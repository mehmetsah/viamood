/**
 * Halköde TEST ortamı — iade/iptal testi.
 *
 *   node --env-file=.env.local scripts/halkode-refund.ts <invoice_id> [tutar]
 *
 * Önce checkstatus ile işlemin durumunu ve iade edilmiş tutarı okur, sonra
 * /api/refund çağırır, ardından checkstatus'u TEKRAR okuyup iadenin gerçekten
 * işlendiğini doğrular (yanıta değil, sisteme bakar).
 *
 * Test ortamı — gerçek para hareketi yoktur.
 */
import { getToken, checkStatus, refund } from '../src/lib/halkode/client.ts';

const invoiceId = process.argv[2];
if (!invoiceId) {
  console.error('kullanım: halkode-refund.ts <invoice_id> [tutar]');
  process.exit(1);
}

const t = await getToken();
if (!t.ok) {
  console.error('token alınamadı:', t.error);
  process.exit(1);
}

const before = await checkStatus(invoiceId, t.token);
console.log('── ÖNCE ──');
console.log(`  durum: ${before.data.transaction_status} · tutar: ${before.data.transaction_amount}` +
  ` · iade edilmiş: ${before.data.total_refunded_amount} · ok=${before.ok}`);

if (!before.ok) {
  console.error('  ⛔ işlem "Completed" değil, iade denenmeyecek.');
  process.exit(1);
}

const amount = Number(process.argv[3] ?? before.data.transaction_amount ?? 0);
console.log(`\n── İADE isteği: ${amount} TRY ──`);
const r = await refund(invoiceId, amount, t.token);
console.log(`  status_code=${r.statusCode} · ${r.description}`);
console.log(`  yanıt: ${JSON.stringify(r.data).slice(0, 400)}`);

// Yanıta değil SİSTEME bak
await new Promise((res) => setTimeout(res, 2000)); // rate limit'e takılmamak için
const after = await checkStatus(invoiceId, t.token);
console.log('\n── SONRA ──');
console.log(`  durum: ${after.data.transaction_status} · iade edilmiş: ${after.data.total_refunded_amount}`);

const refundedBefore = Number(before.data.total_refunded_amount ?? 0);
const refundedAfter = Number(after.data.total_refunded_amount ?? 0);
if (refundedAfter > refundedBefore) console.log(`\n  ✓ İADE GERÇEKLEŞTİ (${refundedBefore} → ${refundedAfter})`);
else console.log(`\n  ✗ iade sistemde görünmüyor (${refundedBefore} → ${refundedAfter})`);
