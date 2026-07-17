/**
 * Kargo takip TEŞHİS endpoint'i (read-only, secret-korumalı).
 *
 * Aktif (teslim edilmemiş) fulfillment'ları order bilgisi + trackByBarcode sonucuyla listeler.
 * "Not Found" kök nedenini ayırt etmek için: (a) local DB'de kalan bayat/test kaydı mı
 * (order Shopify'dan silinmiş), yoksa (b) takip-no formatı KargoLab /track ile uyumsuz mu.
 * DEĞİŞİKLİK YAPMAZ — sadece okur.
 *
 * GET /api/internal/track-diag?key=<SHOPIFY_CLIENT_SECRET>&limit=10
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { fulfillments, orders } from '@/db/schema';
import { env } from '@/lib/env';
import { trackByBarcode } from '@/lib/kargolab/shipments';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = env.SHOPIFY_CLIENT_SECRET ?? '';
  const key = req.nextUrl.searchParams.get('key') ?? '';
  if (!secret || !safeEqual(key, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') ?? 10), 1), 40);

  const rows = await db
    .select({
      fid: fulfillments.id,
      fStatus: fulfillments.status,
      tracking: fulfillments.trackingNumber,
      kargolabShipmentId: fulfillments.kargolabShipmentId,
      orderId: fulfillments.orderId,
      orderName: orders.shopifyOrderName,
      shopifyOrderId: orders.shopifyOrderId,
      fin: orders.financialStatus,
      createdAt: fulfillments.createdAt,
    })
    .from(fulfillments)
    .innerJoin(orders, eq(orders.id, fulfillments.orderId))
    .where(and(inArray(fulfillments.status, ['label_created', 'picked_up', 'in_transit', 'out_for_delivery']), isNotNull(fulfillments.trackingNumber)))
    .limit(limit);

  const results = [];
  for (const r of rows) {
    const tr = await trackByBarcode(r.tracking as string);
    results.push({
      orderName: r.orderName,
      shopifyOrderExists: !!r.shopifyOrderId,
      shopifyOrderId: r.shopifyOrderId,
      fin: r.fin,
      trackingNumber: r.tracking,
      trackingLen: (r.tracking ?? '').length,
      kargolabShipmentId: r.kargolabShipmentId,
      fulfillmentStatus: r.fStatus,
      createdAt: r.createdAt,
      track: tr.ok ? { ok: true, events: tr.events.length, firstStatus: tr.events[0]?.status ?? null } : { ok: false, error: tr.error },
    });
  }

  return NextResponse.json({ count: results.length, results });
}
