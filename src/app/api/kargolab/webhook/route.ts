/**
 * KargoLab kargo durum webhook'u ALICI endpoint (Viamood tarafı).
 *
 * Okan spec'i (2026-07-17):
 *   { barcode, status, status_code, payment_at_door, customer_barcode }
 *   - "ödendi" kararı SADECE status_code == 5 (Türkçe metne GÜVENME). status_code 9 = İADE → asla ödendi.
 *   - customer_barcode = bizim Shopify sipariş no → eşleştirmede BİRİNCİL anahtar (barcode ≠ trackingNumber
 *     olduğundan "Not Found"u da çözer). barcode ikincil.
 *   - Aynı bildirim iki kez gelebilir → idempotent (settleCod atomik claim + dedupe karşılar).
 *   - Auth: x-kargolab-secret header veya ?key=.
 *
 * delivered (code 5) → applyFulfillmentStatus → settleCodOrderOnDelivery (guard'lı; dry-run/kill-switch).
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { eq, and, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { fulfillments, trackingEvents, orders } from '@/db/schema';
import { env } from '@/lib/env';
import { mapCarrierStatus, applyFulfillmentStatus, type MappedStatus } from '@/lib/server/tracking-sync';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

interface FRef {
  id: string;
  orderId: string;
  vendorId: string;
  status: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = env.KARGOLAB_WEBHOOK_SECRET ?? '';
  const key = req.nextUrl.searchParams.get('key') ?? req.headers.get('x-kargolab-secret') ?? '';
  if (!secret || !safeEqual(key, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const barcode = pick(body, ['barcode', 'tracking_number', 'trackingNumber', 'kargo_takip_no', 'takip_no', 'waybill']);
  const customerBarcode = pick(body, ['customer_barcode', 'customerBarcode', 'musteri_barkod']);
  const statusRaw = pick(body, ['status', 'durum', 'hareket', 'event', 'state']);
  const statusCodeStr = pick(body, ['status_code', 'statusCode', 'durum_kodu']);
  const statusCode = statusCodeStr ? Number(statusCodeStr) : NaN;

  // ── Eşleştirme: BİRİNCİL customer_barcode (=Shopify sipariş no) → order → fulfillment; barcode ikincil ──
  let f: FRef | undefined;
  if (customerBarcode) {
    const digits = customerBarcode.replace(/^#/, '');
    const [o] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(or(eq(orders.shopifyOrderName, `#${digits}`), eq(orders.shopifyOrderName, customerBarcode), eq(orders.orderNumber, digits)))
      .limit(1);
    if (o) {
      const fs = await db
        .select({ id: fulfillments.id, orderId: fulfillments.orderId, vendorId: fulfillments.vendorId, status: fulfillments.status, trackingNumber: fulfillments.trackingNumber })
        .from(fulfillments)
        .where(eq(fulfillments.orderId, o.id));
      // Tek fulfillment → o; çoklu (multi-vendor) → barcode ile spesifik koliyi seç
      if (fs.length === 1) f = fs[0];
      else if (fs.length > 1 && barcode) f = fs.find((x) => x.trackingNumber === barcode);
    }
  }
  if (!f && barcode) {
    const [byBarcode] = await db
      .select({ id: fulfillments.id, orderId: fulfillments.orderId, vendorId: fulfillments.vendorId, status: fulfillments.status })
      .from(fulfillments)
      .where(eq(fulfillments.trackingNumber, barcode))
      .limit(1);
    f = byBarcode;
  }
  if (!f) return NextResponse.json({ ok: true, matched: false, customerBarcode, barcode, note: 'sipariş/fulfillment eşleşmedi' });

  // ── tracking_event (dedupe) ──
  const occStr = pick(body, ['occurred_at', 'date', 'tarih', 'timestamp']);
  const parsed = occStr ? new Date(occStr) : new Date();
  const occurred = isNaN(parsed.getTime()) ? new Date() : parsed;
  const eventLabel = statusRaw || (isNaN(statusCode) ? 'unknown' : `code:${statusCode}`);
  const [dup] = await db
    .select({ id: trackingEvents.id })
    .from(trackingEvents)
    .where(and(eq(trackingEvents.fulfillmentId, f.id), eq(trackingEvents.status, eventLabel), eq(trackingEvents.occurredAt, occurred)))
    .limit(1);
  if (!dup) {
    await db.insert(trackingEvents).values({
      fulfillmentId: f.id,
      status: eventLabel,
      location: pick(body, ['location', 'konum']) || null,
      description: pick(body, ['description', 'aciklama']) || null,
      occurredAt: occurred,
      rawPayload: body,
    });
  }

  // ── Statü kararı: status_code BİRİNCİL. delivered SADECE code==5. code==9 (iade) → asla delivered ──
  let mapped: MappedStatus;
  if (statusCode === 5) {
    mapped = 'delivered';
  } else if (statusCode === 9) {
    mapped = null; // İADE — fulfillment ilerletme yok, settleCod ASLA. (event yukarıda kaydedildi)
  } else if (!isNaN(statusCode)) {
    // Bilinen 5/9 dışı sayısal kod: metinden ara-statü çıkar ama delivered'a İZİN VERME
    const m = mapCarrierStatus(statusRaw);
    mapped = m === 'delivered' ? 'in_transit' : m;
  } else {
    // status_code yoksa (eski format) metne düş
    mapped = mapCarrierStatus(statusRaw);
  }

  const applied = mapped ? await applyFulfillmentStatus(f, mapped) : { changed: false };
  return NextResponse.json({ ok: true, matched: true, orderId: f.orderId, statusCode, mapped, deduped: !!dup, ...applied });
}
