import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventoryLevels } from '@/db/schema';

/** Drizzle transaction handle (db.transaction callback param tipi). */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Native sipariş için stok düşümü (FAZ 2). inventory_levels (vendor_id, variant_id) PK.
 * Best-effort: eşleşen satır yoksa 0 satır etkilenir (hata yok). Şimdilik oversell engellemez
 * (Shopify `decrement_obeying_policy` gevşek karşılığı) — sıkı kontrol sonraki dilimde.
 */
export async function decrementForOrder(
  items: Array<{ vendorId: string; variantId: string; quantity: number }>,
  tx: Tx,
): Promise<void> {
  for (const it of items) {
    if (!it.vendorId || !it.variantId || it.quantity <= 0) continue;
    await tx
      .update(inventoryLevels)
      .set({
        available: sql`${inventoryLevels.available} - ${it.quantity}`,
        quantity: sql`${inventoryLevels.quantity} - ${it.quantity}`,
        version: sql`${inventoryLevels.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventoryLevels.vendorId, it.vendorId),
          eq(inventoryLevels.variantId, it.variantId),
        ),
      );
  }
}
