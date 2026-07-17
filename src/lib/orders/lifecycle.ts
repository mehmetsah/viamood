/**
 * Sipariş yaşam döngüsü geçişleri (FAZ 2 Dilim 1 kapanış).
 *
 * Native siparişlerde Shopify webhook'u YOK → paid geçişi + komisyon tetiği native gerekir.
 * Bu helper hem native hem Shopify siparişlerde çalışır (idempotent): havale onayı /
 * COD tahsilatı / kart callback'inde çağrılır. `accrueCommissionForOrder` zaten idempotent
 * (ledger entry varsa no-op) — çift komisyon olmaz.
 */
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders, fulfillments } from '@/db/schema';
import { accrueCommissionForOrder } from '@/lib/server/commission-service';
import { sendEmail } from '@/lib/email/sender';
import { orderDeliveredEmail, orderShippedEmail } from '@/lib/email/templates';
import { env } from '@/lib/env';
import { markShopifyOrderPaid } from '@/lib/shopify/mark-paid';

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

export interface CodSettleResult {
  ok?: boolean;
  skipped?: string;
  dryRun?: boolean;
  paid?: string;
  error?: string;
}

/**
 * COD (kapıda ödeme) siparişi kargo TESLİM edilince Shopify'da otomatik "ödendi" yapar.
 * Yunus kuralı (2026-07-16): "kapıda ödemeli siparişin kargosu teslim edildiğinde Shopify'da ödendi olsun."
 *
 * Guard katmanları (finansal işlem — hepsi geçmeli):
 *   1. COD_AUTO_PAID_ON_DELIVERY master switch (false → kill switch, hiç çalışmaz)
 *   2. Sadece COD (tags 'kapida-odeme') — online ödemelilere DOKUNMAZ
 *   3. Zaten paid/partially_paid değil (idempotency)
 *   4. Siparişin TÜM fulfillment'ları 'delivered' (çoklu tedarikçi: tek teslim tümünü paid yapmaz)
 * COD_AUTO_PAID_DRY_RUN true iken: koşulları kontrol eder, loglar ama Shopify'a POST YAPMAZ.
 * Best-effort — teslim akışını (statü/mail) bloklamaz.
 */
export async function settleCodOrderOnDelivery(
  orderId: string,
  opts: { force?: boolean; forceDryRun?: boolean } = {},
): Promise<CodSettleResult> {
  // opts.force: master switch'i baypas eder (yalnız secret-korumalı test endpoint kullanır).
  // opts.forceDryRun: env'den bağımsız dry-run zorlar (test → asla gerçek POST).
  if (!opts.force && !env.COD_AUTO_PAID_ON_DELIVERY) return { skipped: 'disabled' };

  const [o] = await db
    .select({
      backend: orders.backend,
      shopifyOrderId: orders.shopifyOrderId,
      fin: orders.financialStatus,
      tags: orders.tags,
      totalCents: orders.totalCents,
      name: orders.shopifyOrderName,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!o) return { skipped: 'not_found' };

  // Sadece kapıda ödeme — online (İyzico/PayTR) siparişlere DOKUNMA
  if (!(o.tags ?? []).includes('kapida-odeme')) return { skipped: 'not_cod' };
  // Sadece 'pending' COD işlenir — paid/partially_paid/refunded/voided/authorized/... hepsi elenir
  if (o.fin !== 'pending') return { skipped: `fin_${o.fin}` };

  // Çoklu tedarikçi koruması: siparişin TÜM fulfillment'ları teslim edilmiş olmalı
  const fs = await db
    .select({ status: fulfillments.status })
    .from(fulfillments)
    .where(eq(fulfillments.orderId, orderId));
  if (fs.length === 0 || !fs.every((f) => f.status === 'delivered')) {
    return { skipped: 'not_all_delivered' };
  }

  const amount = (Number(o.totalCents) / 100).toFixed(2);

  if (opts.forceDryRun || env.COD_AUTO_PAID_DRY_RUN) {
    console.log('[cod-settle] DRY-RUN — teslim edildi, ödendi YAPILACAKTI (POST yok):', {
      orderId,
      name: o.name,
      amount,
      backend: o.backend,
    });
    return { dryRun: true, paid: amount };
  }

  // ATOMİK CLAIM (race guard): yalnız TEK eşzamanlı çağrı pending→paid'i kazanır; diğerleri 0 satır
  // görüp çıkar. Bu, çift-tık / çoklu-tedarikçi eşzamanlı teslim durumunda çift Shopify transaction
  // ve çift komisyonu önler (finansal-kritik).
  const claimed = await db
    .update(orders)
    .set({ financialStatus: 'paid', updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.financialStatus, 'pending')))
    .returning({ id: orders.id });
  if (claimed.length === 0) return { skipped: 'race_lost' };

  if (o.backend === 'shopify' && o.shopifyOrderId) {
    // Shopify siparişi: Shopify'da da paid işaretle. Fail olursa lokal claim'i GERİ AL (tutarlılık).
    const numericId = String(o.shopifyOrderId).replace(/\D/g, '');
    const r = await markShopifyOrderPaid(numericId, amount, 'Kapıda Ödeme');
    if (!r.ok) {
      await db
        .update(orders)
        .set({ financialStatus: 'pending', updatedAt: new Date() })
        .where(eq(orders.id, orderId));
      console.error('[cod-settle] Shopify paid hatası, lokal claim geri alındı:', { orderId, error: r.error });
      return { ok: false, error: r.error };
    }
    // Komisyon: Shopify orders/paid webhook'u accrueCommissionForOrder'ı tetikler →
    // burada TEKRAR çağırmıyoruz (aksi çift-accrual + vendor revenue çift-artışı olur).
  } else {
    // Native sipariş (Shopify webhook'u yok): komisyonu burada tetikle (idempotent)
    await accrueCommissionForOrder(orderId).catch((e) =>
      console.error('[cod-settle] native accrue hatası:', e),
    );
  }
  console.log('[cod-settle] COD siparişi TESLİM → ödendi işaretlendi:', { orderId, name: o.name, amount });
  return { ok: true, paid: amount };
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
