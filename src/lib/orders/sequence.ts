import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { orderSequences } from '@/db/schema';

/**
 * Native sipariş numarası üretir (FAZ 2). Atomic increment — `mikro_sync.ts:nextCariSequence` deseni.
 * Format: VM-100001 (Shopify '#1xxx' ile çakışmaz). Migration 0009 sayacı 100000'den başlatır.
 */
export async function nextOrderNumber(): Promise<string> {
  const [row] = await db
    .insert(orderSequences)
    .values({ key: 'native_order_no', value: 100001 })
    .onConflictDoUpdate({
      target: orderSequences.key,
      set: { value: sql`${orderSequences.value} + 1`, updatedAt: new Date() },
    })
    .returning({ value: orderSequences.value });
  return `VM-${row?.value ?? 100001}`;
}
