/**
 * Orphan sipariş temizliği (secret-korumalı). Shopify'dan SİLİNMİŞ ama local DB'de kalan
 * test siparişlerini (order + cascade + RESTRICT bağımlılıkları) temizler.
 *
 * Güvenlik: keepOrderNames ZORUNLU (Shopify'da GERÇEKTEN var olan siparişler — çağıran verir);
 * sadece shopifyOrderId dolu (Shopify-origin) VE keep listesinde OLMAYAN kayıtlar silinir.
 * #1044-#1047 hard-keep. Native sipariş (shopifyOrderId null) asla silinmez. apply=false → dry-run.
 *
 * POST /api/internal/cleanup-orphans?key=<SHOPIFY_CLIENT_SECRET>
 *   body: { keepOrderNames: string[], apply?: boolean }
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { and, inArray, isNotNull, notInArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders, orderLineItems, fulfillments, fulfillmentLineItems, commissionLedger, trackingEvents, orderEvents, routingDecisions } from '@/db/schema';
import { env } from '@/lib/env';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const HARD_KEEP = ['#1044', '#1045', '#1046', '#1047'];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = env.SHOPIFY_CLIENT_SECRET ?? '';
  const key = req.nextUrl.searchParams.get('key') ?? '';
  if (!secret || !safeEqual(key, secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { keepOrderNames?: unknown; apply?: unknown; dump?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const keepInput = Array.isArray(body.keepOrderNames) ? body.keepOrderNames.map(String).filter(Boolean) : [];
  // GUARD: keep listesi boşsa reddet (yoksa tüm Shopify siparişleri orphan sayılır → felaket)
  if (keepInput.length === 0) {
    return NextResponse.json({ error: 'keepOrderNames zorunlu (Shopify\'da var olan siparişler)' }, { status: 400 });
  }
  const keep = Array.from(new Set([...HARD_KEEP, ...keepInput]));
  const apply = body.apply === true;

  // Orphan = Shopify-origin (shopifyOrderId dolu) + keep listesinde OLMAYAN
  const orphans = await db
    .select({ id: orders.id, name: orders.shopifyOrderName, sid: orders.shopifyOrderId, fin: orders.financialStatus })
    .from(orders)
    .where(and(isNotNull(orders.shopifyOrderId), notInArray(orders.shopifyOrderName, keep)));

  const orphanIds = orphans.map((o) => o.id);

  if (!apply) {
    let dump: unknown;
    if (body.dump === true && orphanIds.length > 0) {
      const fids = (await db.select({ id: fulfillments.id }).from(fulfillments).where(inArray(fulfillments.orderId, orphanIds))).map((x) => x.id);
      dump = {
        orders: await db.select().from(orders).where(inArray(orders.id, orphanIds)),
        orderLineItems: await db.select().from(orderLineItems).where(inArray(orderLineItems.orderId, orphanIds)),
        fulfillments: await db.select().from(fulfillments).where(inArray(fulfillments.orderId, orphanIds)),
        fulfillmentLineItems: fids.length ? await db.select().from(fulfillmentLineItems).where(inArray(fulfillmentLineItems.fulfillmentId, fids)) : [],
        commissionLedger: await db.select().from(commissionLedger).where(inArray(commissionLedger.orderId, orphanIds)),
        trackingEvents: fids.length ? await db.select().from(trackingEvents).where(inArray(trackingEvents.fulfillmentId, fids)) : [],
        orderEvents: await db.select().from(orderEvents).where(inArray(orderEvents.orderId, orphanIds)),
        routingDecisions: await db.select().from(routingDecisions).where(inArray(routingDecisions.orderId, orphanIds)),
      };
    }
    const payload = {
      dryRun: true,
      keep,
      orphanCount: orphans.length,
      orphans: orphans.map((o) => ({ name: o.name, fin: o.fin })),
      dump,
    };
    // bigint kolonlar (totalCents vb.) → string (JSON.stringify BigInt'i serialize edemez)
    return new NextResponse(JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // APPLY — RESTRICT bağımlılıkları önce, sonra orders (cascade line_items/fulfillments/events/routing)
  let deleted = 0;
  if (orphanIds.length > 0) {
    await db.transaction(async (tx) => {
      const fids = (await tx.select({ id: fulfillments.id }).from(fulfillments).where(inArray(fulfillments.orderId, orphanIds))).map((f) => f.id);
      await tx.delete(commissionLedger).where(inArray(commissionLedger.orderId, orphanIds));
      if (fids.length > 0) await tx.delete(fulfillmentLineItems).where(inArray(fulfillmentLineItems.fulfillmentId, fids));
      const res = await tx.delete(orders).where(inArray(orders.id, orphanIds)).returning({ id: orders.id });
      deleted = res.length;
    });
  }

  return NextResponse.json({ applied: true, keep, deleted, orphanNames: orphans.map((o) => o.name) });
}
