/**
 * Halköde dönüş hash_key'inin ALAN SIRASINI ölçer.
 *
 * Dokümantasyon dönüş hash'inin içeriğini YAZMIYOR. Ancak paySmart3D hata
 * yanıtında Halköde'nin KENDİ ürettiği bir hash_key geliyor — onu app_secret ile
 * çözüp gerçek sırayı görüyoruz (varsayım yerine ölçüm).
 *
 *   node --env-file=.env.local scripts/halkode-probe.ts
 */
import { getToken, decodeHashKey } from '../src/lib/halkode/client.ts';

const CARDS = ['4132260000000003', '4111111111111111', '5406670000000009'];

const t = await getToken();
if (!t.ok) {
  console.error('token yok:', t.error);
  process.exit(1);
}

for (const card of CARDS) {
  const invoiceId = `probe${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const { generateHashKey } = await import('../src/lib/halkode/client.ts');
  const total = '22.00';
  const hash = generateHashKey(
    {
      total,
      installmentsNumber: 1,
      currencyCode: 'TRY',
      merchantKey: process.env.HALKODE_MERCHANT_KEY!,
      invoiceId,
    },
    process.env.HALKODE_APP_SECRET!,
  );
  const resp = await fetch(`${process.env.HALKODE_BASE_URL}/api/paySmart3D`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${t.token}` },
    body: JSON.stringify({
      cc_holder_name: 'Test Kart',
      cc_no: card,
      expiry_month: '12',
      expiry_year: '2028',
      cvv: '555',
      currency_code: 'TRY',
      installments_number: 1,
      invoice_id: invoiceId,
      invoice_description: 'probe',
      total: Number(total),
      items: [{ name: 'Test', price: 22.0, quantity: 1, description: 'Test' }],
      name: 'Test',
      surname: 'Kullanici',
      merchant_key: process.env.HALKODE_MERCHANT_KEY,
      hash_key: hash,
      return_url: 'https://viamood.com.tr/api/v1/payment/halkode/callback',
      cancel_url: 'https://viamood.com.tr/api/v1/payment/halkode/callback',
    }),
  });
  const text = await resp.text();
  console.log(`\n=== kart ${card.slice(0, 6)}****${card.slice(-4)} · invoice ${invoiceId}`);
  console.log(`    HTTP ${resp.status} · ${text.trimStart().startsWith('<') ? 'HTML (3D formu)' : 'JSON'} · ${text.length} bayt`);
  if (text.trimStart().startsWith('<')) continue;
  try {
    const j = JSON.parse(text);
    const d = j.data ?? {};
    console.log(`    status_code=${j.status_code ?? d.status_code} · ${j.status_description ?? d.error ?? ''}`);
    const hk = d.hash_key ?? j.hash_key;
    if (hk) {
      const parts = decodeHashKey(String(hk), process.env.HALKODE_APP_SECRET!);
      console.log(`    DÖNÜŞ HASH ÇÖZÜLDÜ → ${JSON.stringify(parts?.raw)}`);
      console.log(`    (beklenen invoice_id: ${invoiceId}, total: ${total}, order_no: ${d.order_no ?? '-'})`);
    } else {
      console.log('    (yanıtta hash_key yok)');
    }
  } catch {
    console.log('    JSON parse edilemedi:', text.slice(0, 300));
  }
}
