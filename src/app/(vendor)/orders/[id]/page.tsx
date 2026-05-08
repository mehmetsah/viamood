import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/db/client';
import {
  orderEvents,
  orderLineItems,
  orders,
  vendorMemberships,
  vendors,
} from '@/db/schema';
import { auth } from '@/lib/auth';

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatTL(cents: bigint | number): string {
  return `${(Number(cents) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Routing bekliyor', cls: 'bg-neutral-200 text-neutral-700' },
  awaiting_pickup: { label: 'Etiket bekliyor', cls: 'bg-yellow-100 text-yellow-900' },
  shipped: { label: 'Kargolandı', cls: 'bg-blue-100 text-blue-900' },
  delivered: { label: 'Teslim edildi', cls: 'bg-green-100 text-green-900' },
  cancelled: { label: 'İptal', cls: 'bg-red-100 text-red-900' },
  refunded: { label: 'İade', cls: 'bg-orange-100 text-orange-900' },
};

export default async function VendorOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');

  const [membership] = await db
    .select({ vendorId: vendors.id, name: vendors.name })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) redirect('/onboarding');

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) notFound();

  // Sadece bu vendor'a ait line item'lar
  const items = await db
    .select()
    .from(orderLineItems)
    .where(
      and(eq(orderLineItems.orderId, order.id), eq(orderLineItems.vendorId, membership.vendorId)),
    );

  if (items.length === 0) notFound(); // Bu vendor bu siparişte yok

  const myTotal = items.reduce((s, x) => s + Number(x.totalPriceCents), 0);

  const events = await db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, order.id))
    .orderBy(orderEvents.occurredAt);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/orders" className="text-sm text-neutral-600 hover:underline">
        ← Siparişlerim
      </Link>

      <div className="flex items-start justify-between mt-2 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-mono">{order.shopifyOrderName}</h1>
          <p className="text-neutral-600 text-sm mt-1">
            {order.placedAt.toLocaleString('tr-TR')} · {order.customerName}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">{formatTL(myTotal)}</div>
          <div className="text-sm text-neutral-500 mt-1">Sana ait toplam · {items.length} kalem</div>
        </div>
      </div>

      {/* Fulfillment mode info */}
      {items[0]?.fulfillmentMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm">
          <strong>Fulfillment modu:</strong>{' '}
          {items[0].fulfillmentMode === 'split' && 'Müşteriye doğrudan sen göndereceksin'}
          {items[0].fulfillmentMode === 'consolidate_self' &&
            'Bizim depoya gönder — biz birleştirip müşteriye yollarız'}
          {items[0].fulfillmentMode === 'consolidate_carrier' &&
            'KargoLab kargocu çıkışlı — paket toplama bilgisi sana iletilecek'}
        </div>
      )}

      {/* Items */}
      <section className="bg-white rounded-xl border overflow-hidden mb-8">
        <div className="px-4 py-3 bg-neutral-50 border-b font-bold">Senin kalemlerin</div>
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {items.map((it) => {
              const st = STATUS_LABEL[it.status];
              return (
                <tr key={it.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{it.title}</div>
                    {it.sku && (
                      <div className="text-xs text-neutral-500 font-mono">SKU: {it.sku}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-600 w-20">{it.quantity}×</td>
                  <td className="px-4 py-3 text-right text-neutral-600 w-32 font-mono">
                    {formatTL(it.unitPriceCents)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold w-32">
                    {formatTL(it.totalPriceCents)}
                  </td>
                  <td className="px-4 py-3 w-36">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${st?.cls ?? 'bg-neutral-100'}`}>
                      {st?.label ?? it.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Address */}
      <section className="bg-white rounded-xl border p-6 mb-8">
        <h3 className="font-bold mb-3">Teslimat Adresi</h3>
        {order.shippingAddress && (
          <div className="text-sm space-y-1">
            <div className="font-semibold">{order.shippingAddress.name}</div>
            <div>{order.shippingAddress.address1}</div>
            <div>
              {order.shippingAddress.district} / {order.shippingAddress.city}{' '}
              {order.shippingAddress.postalCode}
            </div>
            <div className="text-neutral-500 text-xs mt-2">{order.shippingAddress.phone}</div>
          </div>
        )}
      </section>

      {/* Phase 4 placeholder */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-sm text-yellow-900">
        <strong>🚚 Faz 4'te buraya geliyor:</strong> KargoLab etiket basma butonu, tracking
        numarası, kargo durumu güncellemesi.
      </div>

      {/* Events (filtered to this order) */}
      <section className="bg-white rounded-xl border p-6 mt-8">
        <h3 className="font-bold mb-4">Olay Kaydı</h3>
        <div className="space-y-2 text-sm">
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 py-1">
              <div className="text-xs text-neutral-400 font-mono w-32 shrink-0">
                {e.occurredAt.toLocaleString('tr-TR')}
              </div>
              <div className="font-semibold">{e.eventType}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
