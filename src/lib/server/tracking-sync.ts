/**
 * Kargo takip statüsü → fulfillment/line-item güncelleme + COD teslim tetiği.
 * Hem KargoLab webhook (birincil) hem polling cron (yedek) bu ortak mantığı kullanır.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { fulfillments, orderLineItems } from '@/db/schema';
import { settleCodOrderOnDelivery, notifyNativeOrderDelivered } from '@/lib/orders/lifecycle';

export type MappedStatus = 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | null;

/** Serbest metin taşıyıcı statüsünü iç enum'a map'ler. Bilinmeyen → null (fulfillment değişmez). */
export function mapCarrierStatus(raw: string): MappedStatus {
  const l = (raw ?? '').toLocaleLowerCase('tr');
  if (l.includes('teslim edil') || l.includes('delivered')) return 'delivered';
  if (l.includes('dağıt') || l.includes('dagit') || l.includes('out_for_delivery')) return 'out_for_delivery';
  if (l.includes('zimmet') || l.includes('transit') || l.includes('yolda') || l.includes('merkez') || l.includes('şube') || l.includes('sube')) return 'in_transit';
  if (l.includes('alındı') || l.includes('alindi') || l.includes('pickup') || l.includes('kabul')) return 'picked_up';
  return null;
}

interface FRef {
  id: string;
  orderId: string;
  vendorId: string;
  status: string;
}

/**
 * Fulfillment statüsünü ilerletir. 'delivered'a geçişte: line-item'ları teslim yapar,
 * "teslim edildi" mailini atar ve COD siparişini settleCodOrderOnDelivery ile otomatik
 * ödendi akışına sokar (guard'lı; dry-run/kill-switch env'e bağlı — bu fonksiyon karar vermez).
 * Statü değişmiyorsa (aynı/null/geri) no-op. Best-effort; çağıran akışı bloklamaz.
 */
export async function applyFulfillmentStatus(f: FRef, mapped: MappedStatus): Promise<{ changed: boolean; delivered?: boolean; settled?: unknown }> {
  // Geri gitme YOK (delivered'dan in_transit'e düşürme gibi); aynı statü → no-op
  const ORDER = ['label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
  if (!mapped) return { changed: false };
  const curIdx = ORDER.indexOf(f.status);
  const newIdx = ORDER.indexOf(mapped);
  if (newIdx <= curIdx) return { changed: false };

  await db
    .update(fulfillments)
    .set({
      status: mapped,
      deliveredAt: mapped === 'delivered' ? new Date() : undefined,
      pickedUpAt: mapped === 'picked_up' ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(fulfillments.id, f.id));

  if (mapped !== 'delivered') return { changed: true };

  await db
    .update(orderLineItems)
    .set({ status: 'delivered' })
    .where(and(eq(orderLineItems.orderId, f.orderId), eq(orderLineItems.vendorId, f.vendorId)));
  notifyNativeOrderDelivered(f.orderId).catch(() => {});
  const settled = await settleCodOrderOnDelivery(f.orderId).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  return { changed: true, delivered: true, settled };
}
