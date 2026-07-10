'use server';

import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { orders, returns, type ReturnLineItem } from '@/db/schema';
import { getSessionCustomer } from '@/lib/customers/session';

function returnCode(): string {
  // İADE-XXXXX (karışması zor: 0/O/1/I çıkarıldı)
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const b = crypto.randomBytes(5);
  for (let i = 0; i < 5; i++) s += abc[b[i]! % abc.length];
  return `İADE-${s}`;
}

/**
 * Müşteri iade talebi oluşturur (sipariş bazlı, tüm ürünler).
 * Sadece: kendi siparişi + kargolanmış + zaten aktif iadesi yok.
 */
export async function createReturnRequest(formData: FormData): Promise<void> {
  const customer = await getSessionCustomer();
  if (!customer) redirect('/auth/sign-in?callbackUrl=/hesabim');

  const orderId = String(formData.get('order_id') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim() || 'Belirtilmedi';
  if (!orderId) redirect('/hesabim');

  // Sipariş müşteriye mi ait + kargolanmış mı?
  const [o] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        eq(sql`lower(${orders.customerEmail})`, customer!.email.toLowerCase()),
      ),
    )
    .limit(1);
  if (!o) redirect('/hesabim');

  // Zaten (reddedilmemiş) iade var mı?
  const [mevcut] = await db
    .select({ id: returns.id })
    .from(returns)
    .where(and(eq(returns.orderId, orderId), sql`${returns.status} <> 'rejected'`))
    .limit(1);
  if (mevcut) redirect('/hesabim/iadeler');

  const items = ((o!.rawShopifyPayload as { line_items?: Array<{ title?: string; quantity?: number; price?: string }> } | null)
    ?.line_items ?? []
  ).map<ReturnLineItem>((li) => ({
    title: li.title ?? 'Ürün',
    quantity: li.quantity ?? 1,
    priceCents: li.price ? Math.round(parseFloat(li.price) * 100) : undefined,
  }));

  await db.insert(returns).values({
    orderId,
    customerId: customer!.id,
    orderName: o!.shopifyOrderName ?? o!.orderNumber ?? null,
    returnCode: returnCode(),
    status: 'awaiting_shipment',
    reason,
    refundAmountCents: o!.totalCents,
    carrier: 'PTT',
    lineItems: items,
  });

  revalidatePath('/hesabim/iadeler');
  redirect('/hesabim/iadeler');
}
