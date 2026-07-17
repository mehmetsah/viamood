/**
 * COD otomatik-ödendi DRY-RUN test kapısı (secret-korumalı).
 *
 * settleCodOrderOnDelivery'yi { force:true, forceDryRun:true } ile çağırır → master switch
 * ve env dry-run'dan BAĞIMSIZ, guard'ları çalıştırır ama Shopify'a ASLA POST yapmaz.
 * Sunucu env'i değiştirmeden mekanizmayı gerçek sipariş üzerinde doğrulamak için.
 *
 * GET /api/internal/cod-settle-test?key=<SHOPIFY_CLIENT_SECRET>&order=<#1044|uuid>
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { eq, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders, fulfillments } from '@/db/schema';
import { env } from '@/lib/env';
import { settleCodOrderOnDelivery } from '@/lib/orders/lifecycle';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const key = req.nextUrl.searchParams.get('key') ?? '';
  const secret = env.SHOPIFY_CLIENT_SECRET ?? '';
  if (!secret || !safeEqual(key, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const ref = (req.nextUrl.searchParams.get('order') ?? '').trim();
  if (!ref) {
    return NextResponse.json({ error: 'order param gerekli (ör. #1044 veya uuid)' }, { status: 400 });
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(ref);
  const [o] = await db
    .select({
      id: orders.id,
      name: orders.shopifyOrderName,
      fin: orders.financialStatus,
      tags: orders.tags,
      backend: orders.backend,
      totalCents: orders.totalCents,
    })
    .from(orders)
    .where(isUuid ? or(eq(orders.id, ref), eq(orders.shopifyOrderName, ref)) : eq(orders.shopifyOrderName, ref))
    .limit(1);
  if (!o) return NextResponse.json({ error: 'order bulunamadı', ref }, { status: 404 });

  const fs = await db
    .select({ status: fulfillments.status })
    .from(fulfillments)
    .where(eq(fulfillments.orderId, o.id));

  // FORCE + zorunlu DRY-RUN — guard'ları çalıştırır, Shopify'a ASLA POST yapmaz
  const dryRunResult = await settleCodOrderOnDelivery(o.id, { force: true, forceDryRun: true });

  return NextResponse.json({
    order: {
      name: o.name,
      financialStatus: o.fin,
      tags: o.tags,
      backend: o.backend,
      total: (Number(o.totalCents) / 100).toFixed(2),
    },
    fulfillmentStatuses: fs.map((f) => f.status),
    dryRunResult,
    note: 'DRY-RUN — Shopify\'a hiçbir şey yazılmadı. dryRunResult.paid = teslimde ödendi YAPILACAK tutar.',
  });
}
