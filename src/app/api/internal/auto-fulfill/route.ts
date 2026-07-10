/**
 * GET /api/internal/auto-fulfill?key=<SHOPIFY_CLIENT_SECRET>&order=<#1015|orderId>[&run=1]
 *
 * SSH'sız uzaktan teşhis: bir siparişin otomatik-etiket durumunu raporlar —
 * satırlara vendor atanmış mı, bizde fulfillment var mı, (run=1 ile) autoFulfillOrder'ı
 * çalıştırıp sonucu (etiket OK / KargoLab hatası / neden atlandı) JSON döner.
 * Yetki: key, webhook secret'ı ile birebir eşleşmeli.
 */
import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { eq, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { fulfillments, orderLineItems, orders, products, productVariants, vendors } from '@/db/schema';
import { env } from '@/lib/env';
import { autoFulfillOrder } from '@/lib/server/auto-fulfill';
import { repairOrderLines } from '@/lib/shopify/order-ingest';
import { routeOrder } from '@/lib/routing/engine';
import { pushFulfillmentToShopify } from '@/lib/shopify/fulfillment-push';
import { syncOrderToMikro } from '@/lib/server/mikro-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function keyOk(key: string | null): boolean {
  const secret = env.SHOPIFY_CLIENT_SECRET;
  if (!secret || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (!keyOk(sp.get('key'))) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  // ?env=1 → hazırlık durumu (secret DEĞERİ sızdırmaz, sadece var/yok) — infra sohbeti bekçileri için
  if (sp.get('env') === '1') {
    return NextResponse.json({
      ok: true,
      resend: !!process.env.RESEND_API_KEY,
      email_from: !!process.env.EMAIL_FROM,
      auth_url: process.env.AUTH_URL ? 'set' : '',
    });
  }

  // ?sku=132 → variant eşleşme teşhisi (order-ingest neden satır yazamadı sorusu için)
  const sku = (sp.get('sku') ?? '').trim();
  if (sku) {
    const rows = await db
      .select({
        sku: productVariants.sku,
        shopifyVariantId: productVariants.shopifyVariantId,
        productTitle: products.title,
        productStatus: products.status,
        shopifyProductId: products.shopifyProductId,
        vendorId: products.vendorId,
        vendorName: vendors.name,
      })
      .from(productVariants)
      .leftJoin(products, eq(products.id, productVariants.productId))
      .leftJoin(vendors, eq(vendors.id, products.vendorId))
      .where(eq(productVariants.sku, sku))
      .limit(10);
    return NextResponse.json({ ok: true, sku, variants: rows });
  }

  const ref = (sp.get('order') ?? '').trim();
  if (!ref) return NextResponse.json({ ok: false, error: 'order param gerekli' }, { status: 422 });

  const name = ref.startsWith('#') ? ref : `#${ref}`;
  // orders.id UUID — geçersiz uuid string'i Postgres'te hata fırlatır, sadece uuid görünümlüyse dahil et
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
  const conds = [eq(orders.shopifyOrderName, name), eq(orders.orderNumber, ref)];
  if (isUuid) conds.push(eq(orders.id, ref));
  const [order] = await db
    .select({
      id: orders.id,
      name: orders.shopifyOrderName,
      orderNumber: orders.orderNumber,
      financialStatus: orders.financialStatus,
      tags: orders.tags,
      cancelledAt: orders.cancelledAt,
      shippingAddress: orders.shippingAddress,
      mikroSyncStatus: orders.mikroSyncStatus,
      mikroError: orders.mikroError,
      mikroEvrakSeri: orders.mikroEvrakSeri,
    })
    .from(orders)
    .where(or(...conds))
    .limit(1);
  if (!order) return NextResponse.json({ ok: false, error: 'order bulunamadı', ref }, { status: 404 });

  const lines = await db
    .select({
      sku: orderLineItems.sku,
      title: orderLineItems.title,
      quantity: orderLineItems.quantity,
      status: orderLineItems.status,
      vendorId: orderLineItems.vendorId,
      vendorName: vendors.name,
    })
    .from(orderLineItems)
    .leftJoin(vendors, eq(vendors.id, orderLineItems.vendorId))
    .where(eq(orderLineItems.orderId, order.id));

  const fuls = await db
    .select({
      id: fulfillments.id,
      carrier: fulfillments.carrier,
      trackingNumber: fulfillments.trackingNumber,
      status: fulfillments.status,
      kargolabShipmentId: fulfillments.kargolabShipmentId,
    })
    .from(fulfillments)
    .where(eq(fulfillments.orderId, order.id));

  // &repair=1 → satırsız siparişin satırlarını raw payload'dan onar + routing çalıştır
  let repair;
  if (sp.get('repair') === '1') {
    repair = await repairOrderLines(order.id);
    if (repair.added > 0) {
      try {
        await routeOrder(order.id);
      } catch (e) {
        console.error('[internal/auto-fulfill] routing hatası:', e);
      }
    }
  }

  const run = sp.get('run') === '1';
  const report = run ? await autoFulfillOrder(order.id) : undefined;

  // &push=1 → bu siparişin Shopify'a işlenmemiş fulfillment'larını Shopify'a push et
  // (scope eksikliği giderildikten sonra #1017-#1026 backfill'i için)
  let shopifyPush;
  if (sp.get('push') === '1') {
    shopifyPush = [];
    for (const f of fuls) {
      const res = await pushFulfillmentToShopify(f.id);
      shopifyPush.push({ fulfillmentId: f.id, ...res });
    }
  }

  // &mikro=1 → Mikro push'u (takip no ile) yeniden dene
  // (SIPARISLER_USER tablosu Mikro tarafında oluşturulunca backfill için)
  let mikro;
  if (sp.get('mikro') === '1') {
    const f = fuls[0];
    mikro = await syncOrderToMikro(order.id, f
      ? { courier: f.carrier, trackingNumber: f.trackingNumber, barcode: null }
      : undefined);
  }

  return NextResponse.json({
    ok: true,
    order,
    lines,
    fulfillments: fuls,
    ...(repair ? { repair } : {}),
    ...(report ? { autoFulfill: report } : {}),
    ...(shopifyPush ? { shopifyPush } : {}),
    ...(mikro ? { mikro } : {}),
  });
}
