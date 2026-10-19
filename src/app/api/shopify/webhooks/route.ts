import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db/client';
import { orderLineItems, orders, products, shopifyConnections } from '@/db/schema';
import { logAudit } from '@/lib/audit/logger';
import { env } from '@/lib/env';
import { routeOrder } from '@/lib/routing/engine';
import { accrueCommissionForOrder } from '@/lib/server/commission-service';
import { syncOrderToMikro } from '@/lib/server/mikro-sync';
import { autoFulfillOrder } from '@/lib/server/auto-fulfill';
import { ingestShopifyOrder, type ShopifyOrderPayload } from '@/lib/shopify/order-ingest';
import { oluMektupYaz } from '@/lib/shopify/olu-mektup';
import { ingestShopifyProduct, type ShopifyProductPayload } from '@/lib/shopify/product-ingest';
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
          console.error('[webhook orders/create] ingest fail:', result.error, 'retryable=', result.retryable);
          // #994753 · R1 — YANIT KODU HATANIN TİPİNE GÖRE SEÇİLİR, ham gövde HER
          // İKİ HÂLDE saklanır; yani kod ne olursa olsun sipariş kaybolmaz.
          //   kalıcı (şema/doğrulama) → 200: tekrar deneme aynı sonucu verir ve
          //     ısrar Shopify'ın ~48 saat sonra ABONELİĞİ kapatmasına yol açar.
          //   geçici (DB/ağ)          → 503: Shopify tekrar denesin, ingest idempotent.
          await oluMektupYaz({ konu: topic, webhookId, shopDomain: shop,
            kalici: !result.retryable, hata: result.error, hamGovde: rawBody });
          return result.retryable
            ? NextResponse.json({ error: 'sipariş işlenemedi, tekrar denenecek' }, { status: 503 })
            : NextResponse.json({ error: result.error, oluMektup: true }, { status: 200 });
        }
        if (result.isNew && result.matchedLineItems > 0) {
          // Routing → ardından OTOMATİK kargo etiketi (müşterinin seçtiği kurye; havale-pending bekler)
          routeOrder(result.orderId)
            .then(() => autoFulfillOrder(result.orderId))
            .catch((err) => {
              console.error('[webhook orders/create] routing/auto-fulfill error:', err);
            });
          // Eğer order paid ise commission accrual da fire-and-forget tetiklensin
          accrueCommissionForOrder(result.orderId).catch((err) => {
            console.error('[webhook orders/create] commission error:', err);
          });
          // Mikro push artık KARGO ETİKETİ SONRASI, takip no ile (fulfillment-service.ts) —
          // el terminali sipariş kağıdını etiketle birlikte bassın. Eski sipariş-anı davranışı
          // MIKRO_PUSH_ON_ORDER=true ile geri gelir.
          if (env.MIKRO_PUSH_ON_ORDER && env.MIKRO_AUTO_PUSH && env.MIKRO_API_URL) {
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
            routeOrder(result.orderId)
              .then(() => autoFulfillOrder(result.orderId))
              .catch(console.error);
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

        // paid'e geçtiyse commission accrual + otomatik kargo etiketi tetikle (ikisi de idempotent)
        // (havale siparişi admin "paid" işaretleyince / kart geç tamamlanınca etiket burada oluşur)
        if (fin === 'paid' || fin === 'partially_paid') {
          accrueCommissionForOrder(existing.id).catch((err) => {
            console.error('[webhook orders/updated] commission error:', err);
          });
          autoFulfillOrder(existing.id).catch((err) => {
            console.error('[webhook orders/updated] auto-fulfill error:', err);
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

      case 'products/create':
      case 'products/update': {
        const result = await ingestShopifyProduct(payload as ShopifyProductPayload);
        if (!result.ok) {
          console.error('[webhook products] ingest fail:', result.error);
          // Ürün senkronu BİLİNÇLİ olarak 200 kalır: kaçan bir ürün güncellemesi
          // `scripts/backfill-products.mts` ile telafi edilebilir, oysa kalıcı 503
          // ısrarı ürün webhook'unun aboneliğini de düşürür. Kayıp olmaması için
          // ham gövde yine ölü mektuba yazılır.
          await oluMektupYaz({ konu: topic, webhookId, shopDomain: shop,
            kalici: true, hata: result.error ?? 'ürün ingest hatası (sebep bildirilmedi)',
            hamGovde: rawBody });
          return NextResponse.json({ error: result.error, oluMektup: true }, { status: 200 });
        }
        await logAudit({
          actorType: 'system',
          actorId: 'shopify-webhook',
          action: 'shopify.product.synced',
          entityType: 'product',
          entityId: result.productId ?? '',
          after: { isNew: result.isNew, variantCount: result.variantCount, vendorSlug: result.vendorSlug },
        });
        return NextResponse.json({ ok: true, productId: result.productId, isNew: result.isNew });
      }

      case 'products/delete': {
        const pid = String((payload as { id: number | string }).id);
        await db
          .update(products)
          .set({ status: 'archived', updatedAt: new Date() })
          .where(eq(products.shopifyProductId, pid));
        return NextResponse.json({ ok: true, archived: pid });
      }

      default:
        console.warn(`[webhook] unhandled topic: ${topic}`);
        return NextResponse.json({ ok: true, ignored: true });
    }
  } catch (err) {
    console.error('[webhook] handler error:', err);
    // #994753 · R1 — BURADA 200 DÖNMEK ASIL SESSİZ KAYIPTI: bu bloğa yalnız
    // FIRLATILMIŞ istisnalar düşer (DB tıkanması, ağ, beklenmeyen hata) ve
    // bunlar tanım gereği GEÇİCİDİR. 200 dönmek Shopify'a "başardım" demekti,
    // yani her veritabanı kesintisi o anki siparişleri kalıcı olarak yok ediyordu.
    // Artık 503 dönüyoruz (Shopify yeniden dener) ve ham gövdeyi de saklıyoruz —
    // yeniden deneme hiç gelmese bile olay deftere yazılı kalır.
    const mesaj = err instanceof Error ? err.message : 'unknown';
    await oluMektupYaz({ konu: topic, webhookId, shopDomain: shop,
      kalici: false, hata: mesaj, hamGovde: rawBody });
    return NextResponse.json({ error: mesaj, oluMektup: true }, { status: 503 });
  }
}
