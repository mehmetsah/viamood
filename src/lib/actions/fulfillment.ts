'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  fulfillments,
  orderLineItems,
  orders,
  trackingEvents,
} from '@/db/schema';
import { auditUser } from '@/lib/audit/logger';
import {
  getShipmentLabel,
  trackByBarcode,
} from '@/lib/kargolab/shipments';
import { notifyNativeOrderDelivered } from '@/lib/orders/lifecycle';
import { createFulfillmentForOrderVendor } from '@/lib/server/fulfillment-service';
import { canEdit, requireActiveVendor } from '@/lib/server/vendor-context';
import type { ActionResult } from './auth';

const createSchema = z.object({
  orderId: z.string().uuid(),
  courrier: z.enum(['PTT', 'ARAS', 'MNG', 'YURTICI', 'SURAT']).optional(),
});

export async function createFulfillmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireActiveVendor();
  if (!canEdit(ctx.role)) return { success: false, error: 'Yetkin yok' };

  const parsed = createSchema.safeParse({
    orderId: formData.get('orderId'),
    courrier: formData.get('courrier') ?? undefined,
  });
  if (!parsed.success) return { success: false, error: 'Geçersiz parametre' };

  // Order bu vendor'a mı ait?
  const [hasItem] = await db
    .select({ id: orderLineItems.id })
    .from(orderLineItems)
    .where(
      and(
        eq(orderLineItems.orderId, parsed.data.orderId),
        eq(orderLineItems.vendorId, ctx.vendorId),
      ),
    )
    .limit(1);
  if (!hasItem) return { success: false, error: 'Bu sipariş sana ait değil' };

  const result = await createFulfillmentForOrderVendor(
    parsed.data.orderId,
    ctx.vendorId,
    { courrier: parsed.data.courrier ?? 'PTT' },
  );

  if (!result.ok) return { success: false, error: result.error };

  await auditUser(
    ctx.userId,
    'fulfillment.created',
    'order',
    parsed.data.orderId,
    {
      after: {
        fulfillmentId: result.fulfillmentId,
        kargolabShipmentId: result.kargolabShipmentId,
        barcode: result.barcode,
      },
    },
  );

  revalidatePath(`/orders/${parsed.data.orderId}`);
  revalidatePath('/orders');
  return { success: true };
}

const labelSchema = z.object({ fulfillmentId: z.string().uuid() });

export async function getFulfillmentLabelAction(
  _prev: { success: boolean; url?: string; error?: string } | null,
  formData: FormData,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const ctx = await requireActiveVendor();
  const parsed = labelSchema.safeParse({ fulfillmentId: formData.get('fulfillmentId') });
  if (!parsed.success) return { success: false, error: 'Geçersiz parametre' };

  const [f] = await db
    .select({
      id: fulfillments.id,
      vendorId: fulfillments.vendorId,
      kargolabShipmentId: fulfillments.kargolabShipmentId,
      labelUrl: fulfillments.labelUrl,
    })
    .from(fulfillments)
    .where(eq(fulfillments.id, parsed.data.fulfillmentId))
    .limit(1);
  if (!f || f.vendorId !== ctx.vendorId) {
    return { success: false, error: 'Fulfillment bulunamadı' };
  }
  if (f.labelUrl) return { success: true, url: f.labelUrl };
  if (!f.kargolabShipmentId) return { success: false, error: 'KargoLab shipment ID yok' };

  const labelRes = await getShipmentLabel(Number(f.kargolabShipmentId));
  if (!labelRes.ok) return { success: false, error: labelRes.error };

  // Eğer KargoLab direkt URL verdiyse onu kullan; vermediyse PDF'i metadata'ya yazıp
  // kendi /api/labels/[id] endpoint'imizden serve edeceğiz.
  let url = labelRes.url;
  if (!url && labelRes.pdfBase64) {
    url = `/api/labels/${f.id}.pdf`;
    await db
      .update(fulfillments)
      .set({
        labelUrl: url,
        metadata: {
          ...((await db
            .select({ metadata: fulfillments.metadata })
            .from(fulfillments)
            .where(eq(fulfillments.id, f.id))
            .limit(1))[0]?.metadata ?? {}),
          kargolabLabelPdf: labelRes.pdfBase64,
          kargolabLabelFileName: labelRes.fileName,
        },
        updatedAt: new Date(),
      })
      .where(eq(fulfillments.id, f.id));
  } else if (url) {
    await db
      .update(fulfillments)
      .set({ labelUrl: url, updatedAt: new Date() })
      .where(eq(fulfillments.id, f.id));
  }
  return { success: true, url };
}

export async function refreshTrackingAction(
  _prev: { success: boolean; events?: number; error?: string } | null,
  formData: FormData,
): Promise<{ success: boolean; events?: number; error?: string }> {
  const ctx = await requireActiveVendor();
  const parsed = labelSchema.safeParse({ fulfillmentId: formData.get('fulfillmentId') });
  if (!parsed.success) return { success: false, error: 'Geçersiz parametre' };

  const [f] = await db
    .select({
      id: fulfillments.id,
      orderId: fulfillments.orderId,
      vendorId: fulfillments.vendorId,
      trackingNumber: fulfillments.trackingNumber,
      status: fulfillments.status,
    })
    .from(fulfillments)
    .where(eq(fulfillments.id, parsed.data.fulfillmentId))
    .limit(1);
  if (!f || f.vendorId !== ctx.vendorId) {
    return { success: false, error: 'Fulfillment bulunamadı' };
  }
  if (!f.trackingNumber) {
    return { success: false, error: 'Tracking number yok' };
  }

  const trackRes = await trackByBarcode(f.trackingNumber);
  if (!trackRes.ok) return { success: false, error: trackRes.error };

  // Insert new events (idempotent: aynı occurredAt + status yoksa)
  let inserted = 0;
  let latestStatus: 'label_created' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned' = f.status as never;

  for (const ev of trackRes.events) {
    const occurred = ev.occurredAt ? new Date(ev.occurredAt) : new Date();
    await db.insert(trackingEvents).values({
      fulfillmentId: f.id,
      status: ev.status,
      location: ev.location ?? null,
      description: ev.description ?? null,
      occurredAt: occurred,
      rawPayload: ev as unknown as Record<string, unknown>,
    });
    inserted += 1;

    const lower = ev.status.toLowerCase();
    if (lower.includes('teslim') || lower.includes('delivered')) latestStatus = 'delivered';
    else if (lower.includes('dağıtım') || lower.includes('out_for_delivery')) latestStatus = 'out_for_delivery';
    else if (lower.includes('transit') || lower.includes('yolda')) latestStatus = 'in_transit';
    else if (lower.includes('alındı') || lower.includes('pickup') || lower.includes('teslim_alindi')) latestStatus = 'picked_up';
  }

  if (latestStatus !== f.status) {
    await db
      .update(fulfillments)
      .set({
        status: latestStatus,
        deliveredAt: latestStatus === 'delivered' ? new Date() : undefined,
        pickedUpAt: latestStatus === 'picked_up' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(fulfillments.id, f.id));

    if (latestStatus === 'delivered') {
      // Line items'ı da delivered yap
      await db
        .update(orderLineItems)
        .set({ status: 'delivered' })
        .where(
          and(
            eq(orderLineItems.orderId, f.orderId),
            eq(orderLineItems.vendorId, f.vendorId),
          ),
        );
      // Native sipariş ise "teslim edildi" e-postası — best-effort
      notifyNativeOrderDelivered(f.orderId).catch(() => {});
    }
  }

  revalidatePath(`/orders/${f.orderId}`);
  return { success: true, events: inserted };
}
