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
import { fulfillments, orderLineItems, orders, vendors } from '@/db/schema';
import { env } from '@/lib/env';
import { autoFulfillOrder } from '@/lib/server/auto-fulfill';

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

  const run = sp.get('run') === '1';
  const report = run ? await autoFulfillOrder(order.id) : undefined;

  return NextResponse.json({
    ok: true,
    order,
    lines,
    fulfillments: fuls,
    ...(report ? { autoFulfill: report } : {}),
  });
}
