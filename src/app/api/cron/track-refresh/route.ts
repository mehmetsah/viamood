/**
 * Kargo takip YEDEK polling cron'u (COD tam-otomatik teslim tespitinin fallback'i).
 *
 * Birincil sinyal KargoLab webhook'udur (anlık). Bu cron, webhook kaçarsa / KargoLab webhook
 * desteklemezse devreye girer: aktif (henüz teslim edilmemiş) kargoları KargoLab'dan periyodik
 * sorgular, teslim tespit edilirse applyFulfillmentStatus ile aynı akışı (COD auto-paid) tetikler.
 *
 * TETİKLEME (sunucu crontab / external scheduler — secret'la):
 *   GET https://<vendor-platform>/api/cron/track-refresh?key=<SHOPIFY_CLIENT_SECRET>&limit=40
 * Öneri sıklık: 30-60 dk (KargoLab rate limit + teslim aciliyeti dengesi).
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { and, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { fulfillments } from '@/db/schema';
import { env } from '@/lib/env';
import { trackByBarcode } from '@/lib/kargolab/shipments';
import { mapCarrierStatus, applyFulfillmentStatus, type MappedStatus } from '@/lib/server/tracking-sync';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const RANK = ['picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = env.SHOPIFY_CLIENT_SECRET ?? '';
  const key = req.nextUrl.searchParams.get('key') ?? '';
  if (!secret || !safeEqual(key, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') ?? 40), 1), 100);

  // Henüz teslim edilmemiş, takip no'su olan aktif kargolar
  const rows = await db
    .select({ id: fulfillments.id, orderId: fulfillments.orderId, vendorId: fulfillments.vendorId, status: fulfillments.status, trackingNumber: fulfillments.trackingNumber })
    .from(fulfillments)
    .where(and(inArray(fulfillments.status, ['label_created', 'picked_up', 'in_transit', 'out_for_delivery']), isNotNull(fulfillments.trackingNumber)))
    .limit(limit);

  let advanced = 0;
  let delivered = 0;
  const settledOrders: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const f of rows) {
    try {
      const tr = await trackByBarcode(f.trackingNumber as string);
      if (!tr.ok) {
        errors.push({ id: f.id, error: tr.error });
      } else {
        // Event'lerden EN İLERİ statüyü seç (geri gitme yok)
        let best: MappedStatus = null;
        for (const ev of tr.events) {
          const m = mapCarrierStatus(ev.status);
          if (m && (best === null || RANK.indexOf(m) > RANK.indexOf(best))) best = m;
        }
        const applied = await applyFulfillmentStatus(f, best);
        if (applied.changed) advanced += 1;
        if (applied.delivered) {
          delivered += 1;
          settledOrders.push(f.orderId);
        }
      }
    } catch (e) {
      errors.push({ id: f.id, error: e instanceof Error ? e.message : String(e) });
    }
    await sleep(250); // rate limit dostu
  }

  return NextResponse.json({
    ok: true,
    scanned: rows.length,
    advanced,
    delivered,
    settledOrders,
    errors: errors.slice(0, 20),
  });
}
