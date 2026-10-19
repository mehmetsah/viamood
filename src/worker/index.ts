/**
 * Worker entry point.
 * Production'da ayrı bir node process, dev'de `npm run worker:dev`.
 */
import { createWorker, QueueName } from '../lib/queue';
import { routeOrder } from '@/lib/routing/engine';
import { sendEmail } from '@/lib/email/sender';
import { siparisIdDogrula, epostaIsiDogrula, desteklenmeyenIs } from './validators';

console.log('🚀 Worker starting...');

// Shopify webhook'un canlı yolu /api/shopify/webhooks'ta HMAC ile doğrulanır.
// BullMQ üzerinde henüz doğrulanmış payload sözleşmesi yok; başarılı TAKLİDİ
// yapmak yerine fail-closed; Shopify'a zaten çalışan doğrudan yolu kullan.
const shopifyWebhookWorker = createWorker(QueueName.ShopifyWebhook, async () => {
  return desteklenmeyenIs('shopify-webhook: imzalı payload işleyicisi');
});

const orderRoutingWorker = createWorker(QueueName.OrderRouting, async (job) => {
  const orderId = siparisIdDogrula(job.data);
  const sonuc = await routeOrder(orderId); // gerçek, idempotent routing
  return { routed: true, mode: sonuc.mode };
});

// Etiket ve para ödemesi alanındaki job sözleşmesi/geri alma kuralı henüz yok:
// "labelCreated:true" / "paid:true" GERÇEK işlem yapılmadan dönmek YASAK.
const fulfillmentWorker = createWorker(QueueName.KargolabFulfillment, async () => {
  return desteklenmeyenIs('kargolab-fulfillment: gönderi sözleşmesi');
});

const payoutWorker = createWorker(QueueName.PayoutProcess, async () => {
  return desteklenmeyenIs('payout-process: finansal onay ve mutabakat');
});

const emailWorker = createWorker(QueueName.EmailNotify, async (job) => {
  const p = epostaIsiDogrula(job.data); // pazarlama izni ve tip zorunludur
  const sonuc = await sendEmail(p);
  if (!sonuc.ok) throw new Error('eposta işi gönderilemedi: ' + (sonuc.error || 'sağlayıcı hatası'));
  return { sent: true, kanal: sonuc.kanal };
});

const workers = [
  shopifyWebhookWorker,
  orderRoutingWorker,
  fulfillmentWorker,
  payoutWorker,
  emailWorker,
];

console.log(`✅ ${workers.length} workers started`);

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down workers...`);
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
