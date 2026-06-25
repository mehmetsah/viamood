/**
 * Sipariş yaşam döngüsü geçişleri (FAZ 2 Dilim 1 kapanış).
 *
 * Native siparişlerde Shopify webhook'u YOK → paid geçişi + komisyon tetiği native gerekir.
 * Bu helper hem native hem Shopify siparişlerde çalışır (idempotent): havale onayı /
 * COD tahsilatı / kart callback'inde çağrılır. `accrueCommissionForOrder` zaten idempotent
 * (ledger entry varsa no-op) — çift komisyon olmaz.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { accrueCommissionForOrder } from '@/lib/server/commission-service';

export interface MarkPaidResult {
  ok: boolean;
  alreadyPaid?: boolean;
  commission?: unknown;
  error?: string;
}

/**
 * Siparişi `paid` işaretler ve komisyon tahakkukunu tetikler. Idempotent.
 * Webhook'un (orders/paid) native karşılığı.
 */
export async function markOrderPaid(orderId: string): Promise<MarkPaidResult> {
  const [o] = await db
    .select({ id: orders.id, fin: orders.financialStatus })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!o) return { ok: false, error: 'order bulunamadı' };
  if (o.fin === 'paid' || o.fin === 'partially_paid') {
    // Zaten paid — komisyonu yine de garanti et (idempotent)
    const commission = await accrueCommissionForOrder(orderId).catch((e) => ({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }));
    return { ok: true, alreadyPaid: true, commission };
  }

  await db
    .update(orders)
    .set({ financialStatus: 'paid', updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  const commission = await accrueCommissionForOrder(orderId).catch((e) => ({
    ok: false,
    error: e instanceof Error ? e.message : String(e),
  }));
  return { ok: true, commission };
}
