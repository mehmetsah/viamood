/**
 * Sipariş → KargoLab kargo etiketi OTOMATİK oluşturma.
 *
 * Müşteri checkout'ta kurye firmasını ve kapıda ödemeyi ZATEN seçiyor →
 * tedarikçinin elle etiket açması gereksiz adım. Kural:
 *   - paid / partially_paid sipariş → etiketle (kart ödemeleri böyle düşer)
 *   - COD (kapida-odeme / tahsilatli-kargo) → etiketle (tahsilat kapıda)
 *   - havale-pending (ödenmemiş) → BEKLE — orders/paid webhook'u paid yapınca etiketlenir
 *
 * Kurye: müşterinin checkout seçimi (rawShopifyPayload.shipping_lines[0].title)
 *        → yoksa admin "Varsayılan kargo firması" ayarı → yoksa PTT.
 * Etiket oluşunca fulfillment-service zinciri devam eder: Shopify push + Mikro'ya
 * takip numarasıyla evrak (el terminali kağıt + etiket birlikte).
 * Idempotent: vendor başına mevcut fulfillment varsa atlanır.
 * KARGOLAB_AUTO_LABEL=false ile tamamen kapatılır (manuel buton her zaman çalışır).
 */
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { orderLineItems, orders } from '@/db/schema';
import { env } from '@/lib/env';
import { getStoreSettings } from '@/lib/settings/store';
import { createFulfillmentForOrderVendor } from '@/lib/server/fulfillment-service';

/** Kurye adı (checkout/KargoLab quote adı, örn "Aras Kargo") → KargoLab kurye kodu */
function courierCode(name: string | null | undefined): string | null {
  if (!name) return null;
  const c = name.toUpperCase();
  if (c.includes('PTT')) return 'PTT';
  if (c.includes('ARAS')) return 'ARAS';
  if (c.includes('MNG')) return 'MNG';
  if (c.includes('YURT')) return 'YURTICI';
  if (c.includes('SURAT') || c.includes('SÜRAT')) return 'SURAT';
  return null;
}

export async function autoFulfillOrder(orderId: string): Promise<void> {
  if (!env.KARGOLAB_AUTO_LABEL) return;

  const [order] = await db
    .select({
      id: orders.id,
      financialStatus: orders.financialStatus,
      cancelledAt: orders.cancelledAt,
      tags: orders.tags,
      raw: orders.rawShopifyPayload,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order || order.cancelledAt) return;

  const tags = (order.tags ?? []).map((t) => String(t).toLowerCase());
  const isCod = tags.some((t) => ['kapida-odeme', 'tahsilatli-kargo', 'cod'].includes(t));
  const isPaid = order.financialStatus === 'paid' || order.financialStatus === 'partially_paid';
  // Ödenmemiş (havale bekleyen vb.) sipariş etiketlenmez — paid olunca orders/paid tetikler
  if (!isPaid && !isCod) return;

  // Kurye: müşterinin checkout seçimi → admin default → PTT
  const raw = order.raw as { shipping_lines?: Array<{ title?: string }> } | null;
  let courrier = courierCode(raw?.shipping_lines?.[0]?.title);
  if (!courrier) {
    try {
      courrier = courierCode((await getStoreSettings()).shipping?.default_courier);
    } catch {
      /* ayar okunamazsa PTT'ye düş */
    }
  }
  courrier = courrier ?? 'PTT';

  // Routing'in vendor atadığı satırlar — vendor başına tek etiket
  const rows = await db
    .selectDistinct({ vendorId: orderLineItems.vendorId })
    .from(orderLineItems)
    .where(and(eq(orderLineItems.orderId, orderId), isNotNull(orderLineItems.vendorId)));

  for (const r of rows) {
    if (!r.vendorId) continue;
    const res = await createFulfillmentForOrderVendor(orderId, r.vendorId, { courrier });
    if (res.ok) {
      console.log('[auto-fulfill] etiket OK', {
        orderId,
        vendorId: r.vendorId,
        courrier,
        fulfillmentId: res.fulfillmentId,
      });
    } else {
      console.error('[auto-fulfill] etiket HATA', { orderId, vendorId: r.vendorId, error: res.error });
    }
  }
}
