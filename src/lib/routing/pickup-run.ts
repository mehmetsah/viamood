/**
 * FAZ 3.3 — Toplama turu operasyonları (server).
 *  - generatePickupRun: günün toplama listesinden rota + tur oluştur, kalemleri awaiting_pickup yap.
 *  - markStopCollected: durak toplandı → kalemler collected, tur durumunu güncelle.
 *  - getLatestPickupRun: en son tur + duraklar (görüntüleme).
 *
 * Kalem durumu değişimi güvenli: yalnız beklenen kaynaktan geçiş (pending→awaiting_pickup,
 * awaiting_pickup→collected) yapılır; başka durumdaki kalem etkilenmez.
 */
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { orderLineItems, pickupRunStops, pickupRuns } from '@/db/schema';
import { getPickupList } from './collection';
import { buildPickupRoute } from './pickup-route';

export type GenerateResult =
  | { ok: true; runId: string; stopCount: number; itemCount: number }
  | { ok: false; error: string };

export async function generatePickupRun(userId?: string): Promise<GenerateResult> {
  const groups = await getPickupList();
  if (groups.length === 0) {
    return { ok: false, error: 'Şu an tedarikçiden toplanacak bekleyen kalem yok.' };
  }

  const route = buildPickupRoute(
    groups.map((g) => ({
      vendorId: g.vendorId,
      vendorName: g.vendorName,
      city: g.city,
      district: g.district,
      itemCount: g.itemCount,
      totalQuantity: g.totalQuantity,
      lineItemIds: g.items.map((i) => i.lineItemId),
    })),
  );

  const runDate = new Date().toISOString().slice(0, 10);
  const itemCount = route.reduce((s, r) => s + r.itemCount, 0);
  const totalQuantity = route.reduce((s, r) => s + r.totalQuantity, 0);
  const allLineItemIds = route.flatMap((r) => r.lineItemIds);

  const runId = await db.transaction(async (tx) => {
    const [run] = await tx
      .insert(pickupRuns)
      .values({
        runDate,
        status: 'planned',
        stopCount: route.length,
        itemCount,
        totalQuantity,
        createdBy: userId ?? null,
      })
      .returning({ id: pickupRuns.id });

    if (!run) throw new Error('pickup_runs kaydı oluşturulamadı.');

    await tx.insert(pickupRunStops).values(
      route.map((r) => ({
        pickupRunId: run.id,
        seq: r.seq,
        vendorId: r.vendorId,
        vendorName: r.vendorName,
        city: r.city,
        district: r.district,
        itemCount: r.itemCount,
        totalQuantity: r.totalQuantity,
        lineItemIds: r.lineItemIds,
        status: 'pending' as const,
      })),
    );

    if (allLineItemIds.length > 0) {
      await tx
        .update(orderLineItems)
        .set({ status: 'awaiting_pickup', updatedAt: new Date() })
        .where(and(inArray(orderLineItems.id, allLineItemIds), eq(orderLineItems.status, 'pending')));
    }

    return run.id;
  });

  return { ok: true, runId, stopCount: route.length, itemCount };
}

export type StopResult = { ok: true } | { ok: false; error: string };

export async function markStopCollected(stopId: string, userId?: string): Promise<StopResult> {
  const [stop] = await db
    .select()
    .from(pickupRunStops)
    .where(eq(pickupRunStops.id, stopId))
    .limit(1);
  if (!stop) return { ok: false, error: 'Durak bulunamadı.' };
  if (stop.status !== 'pending') return { ok: false, error: 'Bu durak zaten işlenmiş.' };

  await db.transaction(async (tx) => {
    await tx
      .update(pickupRunStops)
      .set({ status: 'collected', collectedAt: new Date(), collectedBy: userId ?? null, updatedAt: new Date() })
      .where(eq(pickupRunStops.id, stopId));

    if (stop.lineItemIds.length > 0) {
      await tx
        .update(orderLineItems)
        .set({ status: 'collected', updatedAt: new Date() })
        .where(
          and(
            inArray(orderLineItems.id, stop.lineItemIds),
            eq(orderLineItems.status, 'awaiting_pickup'),
          ),
        );
    }

    // Tüm duraklar işlendiyse turu tamamla, değilse "toplanıyor".
    const stops = await tx
      .select({ status: pickupRunStops.status })
      .from(pickupRunStops)
      .where(eq(pickupRunStops.pickupRunId, stop.pickupRunId));
    const allDone = stops.every((s) => s.status !== 'pending');
    await tx
      .update(pickupRuns)
      .set({ status: allDone ? 'completed' : 'collecting', updatedAt: new Date() })
      .where(eq(pickupRuns.id, stop.pickupRunId));
  });

  return { ok: true };
}

export async function getLatestPickupRun() {
  const [run] = await db.select().from(pickupRuns).orderBy(desc(pickupRuns.createdAt)).limit(1);
  if (!run) return null;
  const stops = await db
    .select()
    .from(pickupRunStops)
    .where(eq(pickupRunStops.pickupRunId, run.id))
    .orderBy(pickupRunStops.seq);
  return { run, stops };
}
