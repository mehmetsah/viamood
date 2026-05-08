import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { orderLineItems, orders, vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Routing bekliyor', cls: 'bg-neutral-200 text-neutral-700' },
  awaiting_pickup: { label: 'Etiket bekliyor', cls: 'bg-yellow-100 text-yellow-900' },
  shipped: { label: 'Kargolandı', cls: 'bg-blue-100 text-blue-900' },
  delivered: { label: 'Teslim edildi', cls: 'bg-green-100 text-green-900' },
  cancelled: { label: 'İptal', cls: 'bg-red-100 text-red-900' },
  refunded: { label: 'İade', cls: 'bg-orange-100 text-orange-900' },
};

function formatTL(cents: bigint): string {
  return `${(Number(cents) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

export default async function VendorOrdersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');

  const [membership] = await db
    .select({ vendorId: vendors.id })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) redirect('/onboarding');

  // Vendor'a ait line item'ları + ait olduğu order'ı çek
  const rows = await db
    .select({
      lineItemId: orderLineItems.id,
      orderId: orders.id,
      orderName: orders.shopifyOrderName,
      placedAt: orders.placedAt,
      customerName: orders.customerName,
      title: orderLineItems.title,
      sku: orderLineItems.sku,
      quantity: orderLineItems.quantity,
      totalPriceCents: orderLineItems.totalPriceCents,
      status: orderLineItems.status,
      fulfillmentMode: orderLineItems.fulfillmentMode,
      shippingCity: orders.shippingAddress,
    })
    .from(orderLineItems)
    .innerJoin(orders, eq(orders.id, orderLineItems.orderId))
    .where(eq(orderLineItems.vendorId, membership.vendorId))
    .orderBy(desc(orders.placedAt))
    .limit(200);

  // Group by orderId so each order shows once
  const byOrder = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byOrder.get(r.orderId) ?? [];
    arr.push(r);
    byOrder.set(r.orderId, arr);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Siparişlerim</h1>
      <p className="text-neutral-600 text-sm mb-8">
        Sadece sana atanmış line item'ları içeren siparişler. {byOrder.size} sipariş.
      </p>

      {byOrder.size === 0 ? (
        <div className="bg-white rounded-xl p-16 border text-center text-neutral-500">
          Henüz sipariş yok
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(byOrder.entries()).map(([orderId, items]) => {
            const first = items[0]!;
            const myTotal = items.reduce((s, x) => s + Number(x.totalPriceCents), 0);
            const city = (first.shippingCity as { city?: string } | null)?.city ?? '';
            return (
              <Link
                key={orderId}
                href={`/orders/${orderId}`}
                className="block bg-white rounded-xl border p-5 hover:border-[var(--color-brand-orange)] transition"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="font-mono font-bold text-[var(--color-brand-orange)]">
                      {first.orderName}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {first.placedAt.toLocaleString('tr-TR')} · {first.customerName} · {city}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold font-mono">{formatTL(BigInt(myTotal))}</div>
                    <div className="text-xs text-neutral-500">{items.length} kalem</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {items.map((it) => {
                    const st = STATUS_LABEL[it.status];
                    return (
                      <span key={it.lineItemId} className={`px-2 py-1 rounded font-bold ${st?.cls ?? 'bg-neutral-100'}`}>
                        {it.title} ({it.quantity}×) — {st?.label ?? it.status}
                      </span>
                    );
                  })}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
