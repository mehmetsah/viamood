/**
 * KargoLab kargo durum webhook'u ALICI endpoint (Viamood tarafı).
 *
 * KargoLab, bir gönderi statüsü değiştiğinde (zimmete alındı / dağıtımda / teslim edildi vb.)
 * buraya POST atar. Endpoint:
 *   1. secret doğrular (?key= veya x-kargolab-secret header)
 *   2. barcode ile fulfillment'ı bulur, tracking_event ekler (dedupe)
 *   3. statüyü map'ler; 'delivered' ise line-item'ları teslim yapar + COD siparişini
 *      settleCodOrderOnDelivery ile otomatik "ödendi" akışına sokar (guard'lı, dry-run/kill-switch).
 *
 * Bu, COD tam-otomatik (butonsuz) teslim tespitinin BİRİNCİL kaynağıdır; polling cron yedektir.
 *
 * KONTRAT (KargoLab tarafına verilecek):
 *   POST https://<vendor-platform>/api/kargolab/webhook?key=<KARGOLAB_WEBHOOK_SECRET>
 *   Body (JSON, alan isimleri esnek): { barcode|tracking_number|kargo_takip_no,
 *     status|durum|hareket, description?, location?, occurred_at?|date? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { fulfillments, trackingEvents, orderLineItems } from '@/db/schema';
import { env } from '@/lib/env';
import { settleCodOrderOnDelivery, notifyNativeOrderDelivered } from '@/lib/orders/lifecycle';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

type Mapped = 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | null;
function mapStatus(raw: string): Mapped {
  const l = raw.toLocaleLowerCase('tr');
  if (l.includes('teslim edil') || l.includes('delivered')) return 'delivered';
  if (l.includes('dağıt') || l.includes('dagit') || l.includes('out_for_delivery')) return 'out_for_delivery';
  if (l.includes('zimmet') || l.includes('transit') || l.includes('yolda') || l.includes('merkez') || l.includes('şube')) return 'in_transit';
  if (l.includes('alındı') || l.includes('alindi') || l.includes('pickup') || l.includes('kabul')) return 'picked_up';
  return null; // bilinmeyen statü — event yine kaydedilir, fulfillment durumu değişmez
}

function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
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
  const statusRaw = pick(body, ['status', 'durum', 'hareket', 'event', 'state']);
  if (!barcode) return NextResponse.json({ error: 'barcode/tracking_number gerekli' }, { status: 400 });

  const [f] = await db
    .select({ id: fulfillments.id, orderId: fulfillments.orderId, vendorId: fulfillments.vendorId, status: fulfillments.status })
    .from(fulfillments)
    .where(eq(fulfillments.trackingNumber, barcode))
    .limit(1);
  // Eşleşme yoksa 200 dön (KargoLab retry etmesin) — ama not düş
  if (!f) return NextResponse.json({ ok: true, matched: false, barcode, note: 'bu barcode ile fulfillment yok' });

  const occStr = pick(body, ['occurred_at', 'date', 'tarih', 'timestamp']);
  const occurredAt = occStr ? new Date(occStr) : new Date();
  const occurred = isNaN(occurredAt.getTime()) ? new Date() : occurredAt;

  // Dedupe: aynı fulfillment + statü + zaman zaten varsa tekrar yazma
  const [dup] = await db
    .select({ id: trackingEvents.id })
    .from(trackingEvents)
    .where(and(eq(trackingEvents.fulfillmentId, f.id), eq(trackingEvents.status, statusRaw), eq(trackingEvents.occurredAt, occurred)))
    .limit(1);
  if (!dup) {
    await db.insert(trackingEvents).values({
      fulfillmentId: f.id,
      status: statusRaw,
      location: pick(body, ['location', 'konum', 'yer']) || null,
      description: pick(body, ['description', 'aciklama', 'açıklama']) || null,
      occurredAt: occurred,
      rawPayload: body,
    });
  }

  const mapped = mapStatus(statusRaw);
  let settled: unknown;
  if (mapped && mapped !== f.status) {
    await db
      .update(fulfillments)
      .set({
        status: mapped,
        deliveredAt: mapped === 'delivered' ? new Date() : undefined,
        pickedUpAt: mapped === 'picked_up' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(fulfillments.id, f.id));

    if (mapped === 'delivered') {
      await db
        .update(orderLineItems)
        .set({ status: 'delivered' })
        .where(and(eq(orderLineItems.orderId, f.orderId), eq(orderLineItems.vendorId, f.vendorId)));
      notifyNativeOrderDelivered(f.orderId).catch(() => {});
      // COD tam-otomatik: teslim → Shopify'da otomatik ödendi (guard'lı; dry-run/kill-switch env'e bağlı)
      settled = await settleCodOrderOnDelivery(f.orderId).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
    }
  }

  return NextResponse.json({ ok: true, matched: true, barcode, status: statusRaw, mapped, deduped: !!dup, settled });
}
