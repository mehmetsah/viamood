import { Queue, Worker, type Job, type Processor } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './env';

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // BullMQ requires this
});

connection.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});

/**
 * Tanımlı queue isimleri.
 * Yeni job tipi eklerken buraya da ekle.
 */
export const QueueName = {
  ShopifyWebhook: 'shopify-webhook',
  ShopifySync: 'shopify-sync',
  OrderRouting: 'order-routing',
  KargolabFulfillment: 'kargolab-fulfillment',
  PayoutProcess: 'payout-process',
  EmailNotify: 'email-notify',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

/** Queue cache — aynı queue'yu tekrar yaratmayalım. */
const queues = new Map<QueueName, Queue>();

export function getQueue<T = unknown>(name: QueueName): Queue<T> {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 }, // 24 saat veya max 1000 sakla
        removeOnFail: { age: 7 * 24 * 3600 }, // başarısız 7 gün kalsın
      },
    });
    queues.set(name, q);
  }
  return q as Queue<T>;
}

/** Worker helper. Worker process'inde çağrılır. */
export function createWorker<T = unknown>(
  name: QueueName,
  processor: Processor<T>,
  concurrency = 5,
): Worker<T> {
  const worker = new Worker<T>(name, processor, {
    connection,
    concurrency,
  });

  worker.on('failed', (job: Job<T> | undefined, err: Error) => {
    console.error(`[worker:${name}] job ${job?.id} failed:`, err.message);
  });

  worker.on('completed', (job: Job<T>) => {
    console.log(`[worker:${name}] job ${job.id} completed`);
  });

  return worker;
}

export { connection as redisConnection };
