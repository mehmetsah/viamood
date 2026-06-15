import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db/client';
import { orderLineItems, orders, shopifyConnections } from '@/db/schema';
import { logAudit } from '@/lib/audit/logger';
import { env } from '@/lib/env';
import { routeOrder } from '@/lib/routing/engine';
import { accrueCommissionForOrder } from '@/lib/server/commission-service';
import { syncOrderToMikro } from '@/lib/server/mikro-sync';
import { ingestShopifyOrder, type ShopifyOrderPayload } from '@/lib/shopify/order-ingest';
import { verifyShopifyWebhook } from '@/lib/shopify/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tek webhook endpoint, X-Shopify-Topic header'ına göre dispatch.
 * Subscribe edilen topic'ler:
 *   - orders/create
 *   - orders/updated
 *   - orders/cancelled
 *   - app/uninstalled
 *
 * Önemli: Shopify 5sn içinde 200 yanıtı bekler. Heavy work background'a alınmalı.
 * Routing engine zaten hızlı (DB only), ama ileride BullMQ queue'ya alınabilir.
 */
export async function POST(req: NextRequest) {
  const topic = req.headers.get('x-shopify-topic') ?? '';
  const shop = req.headers.get('x-shopify-shop-domain') ?? '';
  const hmac = req.headers.get('x-shopify-hmac-sha256') ?? '';
  const webhookId = req.headers.get('x-shopify-webhook-id') ?? '';

  const rawBody = await req.text();

  if (!topic || !hmac) {
    return NextResponse.json({ error: 'topic veya hmac eksik' }, { status: 400 });
  }
  if (!verifyShopifyWebhook(rawBody, hmac)) {
    console.warn(`[webhook] HMAC fail topic=${topic} shop=${shop}`);
    return NextResponse.json({ error: 'HMAC doğrulaması başarısız' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON parse hatası' }, { status: 400 });
  }

  console.log(`[webhook] received topic=${topic} shop=${shop} id=${webhookId}`);

  try {
    switch (topic) {
      case 'orders/create': {
        const result = await ingestShopifyOrder(payload as ShopifyOrderPayload);
        if (!result.ok) {
          console.error('[webhook orders/create] ingest fail:', result.error);
          return NextResponse.json({ error: result.error }, { status: 200 }); // 200 ki retry olmasın
        }
        if (result.isNew && result.matchedLineItems > 0) {
          // Routing fire-and-forget (errored olsa da webhook 200 dönsün)
          routeOrder(result.orderId).catch((err) => {
            console.error('[webhook orders/create] routing error:', err);
          });
          // Eğer order paid ise commission accrual da fire-and-forget tetiklensin
          accrueCommissionForOrder(result.orderId).catch((err) => {
            console.error('[webhook orders/create] commission error:', err);
          });
          // Mikro V17'ye push (auto-push aktifse) — muhasebe için CariKayit + SiparisEkle + SiparisOnayla
          if (env.MIKRO_AUTO_PUSH && env.MIKRO_API_URL) {
            syncOrderToMikro(result.orderId).catch((err) => {
              console.error('[webhook orders/create] mikro sync error:', err);
            });
          }
        }
        await logAudit({
          actorType: 'system',
          actorId: 'shopify-webhook',
          action: 'shopify.order.received',
          entityType: 'order',
          entityId: result.orderId,
          after: {
            isNew: result.isNew,
            matchedLineItems: result.matchedLineItems,
            unmatchedLineItems: result.unmatchedLineItems,
          },
        });
        return NextResponse.json({
          ok: true,
          orderId: result.orderId,
          isNew: result.isNew,
        });
      }

      case 'orders/updated':
      case 'orders/paid':
      case 'orders/cancelled':
      case 'orders/fulfilled': {
        const order = payload as ShopifyOrderPayload & { financial_status?: string; fulfillment_status?: string; cancelled_at?: string; cancel_reason?: string };
        const shopifyOrderId = String(order.id);
        const [existing] = await db
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.shopifyOrderId, shopifyOrderId))
          .limit(1);
        if (!existing) {
          // Order bizde yok — orders/create kaçırılmış olabilir, ingest et
          const result = await ingestShopifyOrder(order);
          if (result.ok && result.isNew && result.matchedLineItems > 0) {
            routeOrder(result.orderId).catch(console.error);
          }
          return NextResponse.json({ ok: true, ingestedLate: true });
        }

        const fin = order.financial_status as
          | 'pending'
          | 'authorized'
          | 'paid'
          | 'partially_paid'
          | 'refunded'
          | 'partially_refunded'
          | 'voided'
          | undefined;
        const ful = order.fulfillment_status as
          | 'unfulfilled'
          | 'partial'
          | 'fulfilled'
          | 'restocked'
          | undefined;

        await db
          .update(orders)
          .set({
            financialStatus: fin ?? undefined,
            fulfillmentStatus: ful ?? undefined,
            cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : undefined,
            cancelReason: order.cancel_reason ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, existing.id));

        // paid'e geçtiyse commission accrual tetikle (idempotent)
        if (fin === 'paid' || fin === 'partially_paid') {
          accrueCommissionForOrder(existing.id).catch((err) => {
            console.error('[webhook orders/updated] commission error:', err);
          });
        }

        return NextResponse.json({ ok: true, updated: existing.id });
      }

      case 'app/uninstalled': {
        // App bağlantısı sökülmüş — connection'ı pasif işaretle
        await db
          .update(shopifyConnections)
          .set({ uninstalledAt: new Date(), updatedAt: new Date() })
          .where(eq(shopifyConnections.shopDomain, shop));
        await logAudit({
          actorType: 'system',
          actorId: 'shopify-webhook',
          action: 'shopify.app.uninstalled',
          entityType: 'shopify_connection',
          entityId: shop,
        });
        return NextResponse.json({ ok: true });
      }

      default:
        console.warn(`[webhook] unhandled topic: ${topic}`);
        return NextResponse.json({ ok: true, ignored: true });
    }
  } catch (err) {
    console.error('[webhook] handler error:', err);
    // 200 dönüyoruz — retry storm'a yol açmamak için (audit'ten sonra manuel inceleme)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 200 },
    );
  }
}
