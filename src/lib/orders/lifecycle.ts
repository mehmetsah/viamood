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
import { sendEmail } from '@/lib/email/sender';
import { orderDeliveredEmail, orderShippedEmail } from '@/lib/email/templates';

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

/**
 * "Kargoya verildi" e-postası — HER backend için (Türkçe, takip linkli). Best-effort.
 * Shopify siparişlerinde de bizden gider: scope eksikken Shopify kendi kargo mailini
 * atamıyor; scope gelse de fulfillmentCreate notifyCustomer:false → bizimki tek kaynak.
 */
export async function notifyNativeOrderShipped(
  orderId: string,
  ship: { carrier?: string; trackingNumber?: string | null; trackingUrl?: string | null },
): Promise<void> {
  try {
    const [o] = await db
      .select({
        backend: orders.backend,
        orderNumber: orders.orderNumber,
        shopifyOrderName: orders.shopifyOrderName,
        email: orders.customerEmail,
        name: orders.customerName,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!o || !o.email) return;
    const tpl = orderShippedEmail({
      orderNumber: o.shopifyOrderName ?? o.orderNumber ?? orderId,
      customerName: o.name ?? '',
      carrier: ship.carrier,
      trackingNumber: ship.trackingNumber,
      trackingUrl: ship.trackingUrl,
    });
    await sendEmail({ to: o.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (e) {
    console.error('[lifecycle] shipped email error:', e);
  }
}

/** Native sipariş için "teslim edildi" e-postası (FAZ 2 Dilim 3). Best-effort. */
export async function notifyNativeOrderDelivered(orderId: string): Promise<void> {
  try {
    const [o] = await db
      .select({
        backend: orders.backend,
        orderNumber: orders.orderNumber,
        email: orders.customerEmail,
        name: orders.customerName,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!o || o.backend !== 'native' || !o.email) return;
    const tpl = orderDeliveredEmail({ orderNumber: o.orderNumber ?? orderId, customerName: o.name ?? '' });
    await sendEmail({ to: o.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (e) {
    console.error('[lifecycle] delivered email error:', e);
  }
}
