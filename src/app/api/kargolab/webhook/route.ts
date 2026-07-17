/**
 * KargoLab kargo durum webhook'u ALICI endpoint (Viamood tarafı).
 *
 * KargoLab, bir gönderi statüsü değiştiğinde (zimmete alındı / dağıtımda / teslim edildi vb.)
 * buraya POST atar. Endpoint: secret doğrular → barcode ile fulfillment'ı bulur → tracking_event
 * ekler (dedupe) → statüyü map'ler → applyFulfillmentStatus (delivered'da COD auto-paid akışı).
 *
 * COD tam-otomatik teslim tespitinin BİRİNCİL kaynağıdır; polling cron yedektir.
 *
 * KONTRAT (KargoLab tarafına verilecek):
 *   POST https://<vendor-platform>/api/kargolab/webhook?key=<KARGOLAB_WEBHOOK_SECRET>
 *   Body (JSON, esnek): { barcode|tracking_number|kargo_takip_no, status|durum|hareket,
 *     description?, location?, occurred_at?|date? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { fulfillments, trackingEvents } from '@/db/schema';
import { env } from '@/lib/env';
import { mapCarrierStatus, applyFulfillmentStatus } from '@/lib/server/tracking-sync';

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
  if (!f) return NextResponse.json({ ok: true, matched: false, barcode, note: 'bu barcode ile fulfillment yok' });

  const occStr = pick(body, ['occurred_at', 'date', 'tarih', 'timestamp']);
  const parsed = occStr ? new Date(occStr) : new Date();
  const occurred = isNaN(parsed.getTime()) ? new Date() : parsed;

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

  const mapped = mapCarrierStatus(statusRaw);
  const applied = await applyFulfillmentStatus(f, mapped);
  return NextResponse.json({ ok: true, matched: true, barcode, status: statusRaw, mapped, deduped: !!dup, ...applied });
}
