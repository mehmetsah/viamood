/**
 * Worker entry point.
 * Production'da ayrı bir node process, dev'de `npm run worker:dev`.
 */
import { createWorker, QueueName } from '../lib/queue';

console.log('🚀 Worker starting...');

// Stub processors — Phase 2'de gerçek implementasyon gelecek
const shopifyWebhookWorker = createWorker(QueueName.ShopifyWebhook, async (job) => {
  console.log(`[shopify-webhook] processing ${job.name}`, job.data);
  // TODO: Phase 2 — webhook payload'ı DB'ye yaz
  return { processed: true };
});

const orderRoutingWorker = createWorker(QueueName.OrderRouting, async (job) => {
  console.log(`[order-routing] processing ${job.name}`, job.data);
  // TODO: Phase 3 — routing engine
  return { routed: true };
});

const fulfillmentWorker = createWorker(QueueName.KargolabFulfillment, async (job) => {
  console.log(`[kargolab] processing ${job.name}`, job.data);
  // TODO: Phase 4 — KargoLab API çağrısı
  return { labelCreated: true };
});

const payoutWorker = createWorker(QueueName.PayoutProcess, async (job) => {
  console.log(`[payout] processing ${job.name}`, job.data);
  // TODO: Phase 5 — payout batch işleme
  return { paid: true };
});

const emailWorker = createWorker(QueueName.EmailNotify, async (job) => {
  console.log(`[email] processing ${job.name}`, job.data);
  // TODO: Resend API
  return { sent: true };
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
