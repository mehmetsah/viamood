import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import {
  orderEvents,
  orderLineItems,
  orders,
  routingDecisions,
  routingRules,
  vendors,
} from '@/db/schema';

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatTL(cents: bigint | number): string {
  return `${(Number(cents) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

const MODE_LABELS = {
  split: { label: 'Split (her vendor ayrı)', cls: 'bg-blue-100 text-blue-900' },
  consolidate_self: { label: 'Consolidate (biz)', cls: 'bg-purple-100 text-purple-900' },
  consolidate_carrier: { label: 'Consolidate (kargocu)', cls: 'bg-pink-100 text-pink-900' },
};

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) notFound();

  // Line items + vendor info
  const items = await db
    .select({
      id: orderLineItems.id,
      vendorId: orderLineItems.vendorId,
      vendorName: vendors.name,
      title: orderLineItems.title,
      sku: orderLineItems.sku,
      quantity: orderLineItems.quantity,
      unitPriceCents: orderLineItems.unitPriceCents,
      totalPriceCents: orderLineItems.totalPriceCents,
      status: orderLineItems.status,
      fulfillmentMode: orderLineItems.fulfillmentMode,
    })
    .from(orderLineItems)
    .innerJoin(vendors, eq(vendors.id, orderLineItems.vendorId))
    .where(eq(orderLineItems.orderId, order.id))
    .orderBy(asc(orderLineItems.createdAt));

  // Routing decision
  const [decision] = await db
    .select({
      mode: routingDecisions.mode,
      assignments: routingDecisions.assignments,
      matchedRuleId: routingDecisions.matchedRuleId,
      ruleName: routingRules.name,
    })
    .from(routingDecisions)
    .leftJoin(routingRules, eq(routingRules.id, routingDecisions.matchedRuleId))
    .where(eq(routingDecisions.orderId, order.id))
    .limit(1);

  // Events
  const events = await db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, order.id))
    .orderBy(asc(orderEvents.occurredAt))
    .limit(50);

  // Group line items by vendor
  const itemsByVendor = new Map<string, typeof items>();
  for (const it of items) {
    const arr = itemsByVendor.get(it.vendorId) ?? [];
    arr.push(it);
    itemsByVendor.set(it.vendorId, arr);
  }

  const modeStyle = decision ? MODE_LABELS[decision.mode] : null;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/admin/orders" className="text-sm text-neutral-600 hover:underline">
        ← Tüm siparişler
      </Link>

      <div className="flex items-start justify-between mt-2 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-mono">{order.shopifyOrderName}</h1>
          <p className="text-neutral-600 text-sm mt-1">
            {order.placedAt.toLocaleString('tr-TR')} · {order.customerName} · {order.customerEmail}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">{formatTL(order.totalCents)}</div>
          <div className="text-sm text-neutral-500 mt-1">{items.length} kalem · {itemsByVendor.size} vendor</div>
        </div>
      </div>

      {/* Routing decision card */}
      <section className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Routing Kararı</h2>
          {modeStyle && (
            <span className={`text-xs font-bold px-3 py-1 rounded ${modeStyle.cls}`}>
              {modeStyle.label}
            </span>
          )}
        </div>
        {decision ? (
          <div className="text-sm space-y-2">
            {decision.ruleName ? (
              <p>
                <strong>Eşleşen kural:</strong>{' '}
                <Link
                  href={`/admin/routing-rules/${decision.matchedRuleId}`}
                  className="text-[var(--color-brand-orange)] hover:underline"
                >
                  {decision.ruleName}
                </Link>
              </p>
            ) : (
              <p className="text-neutral-600">Kural eşleşmedi — default split uygulandı.</p>
            )}
            <p className="text-neutral-600">
              {Array.isArray(decision.assignments) ? decision.assignments.length : 0} vendor'a atama yapıldı.
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Henüz routing yapılmadı</p>
        )}
      </section>

      {/* Line items per vendor */}
      <h2 className="font-bold text-lg mb-4">Kalemler</h2>
      <div className="space-y-4 mb-8">
        {Array.from(itemsByVendor.entries()).map(([vendorId, vItems]) => {
          const total = vItems.reduce((s, x) => s + Number(x.totalPriceCents), 0);
          return (
            <div key={vendorId} className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 bg-neutral-50 border-b flex items-center justify-between">
                <div>
                  <span className="font-bold">{vItems[0]!.vendorName}</span>
                  <span className="text-xs text-neutral-500 ml-2">
                    {vItems.length} kalem · Mode: {vItems[0]!.fulfillmentMode ?? '—'}
                  </span>
                </div>
                <div className="font-mono font-bold">{formatTL(BigInt(total))}</div>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {vItems.map((it) => (
                    <tr key={it.id}>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{it.title}</div>
                        {it.sku && <div className="text-xs text-neutral-500 font-mono">SKU: {it.sku}</div>}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600 w-20">
                        {it.quantity}×
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600 w-32 font-mono">
                        {formatTL(it.unitPriceCents)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold w-32">
                        {formatTL(it.totalPriceCents)}
                      </td>
                      <td className="px-4 py-3 w-32">
                        <span className="text-xs font-bold px-2 py-1 rounded bg-neutral-100">
                          {it.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* Address + payment */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <section className="bg-white rounded-xl border p-6">
          <h3 className="font-bold mb-3">Teslimat Adresi</h3>
          {order.shippingAddress && (
            <div className="text-sm space-y-1">
              <div>{order.shippingAddress.name}</div>
              <div>{order.shippingAddress.address1}</div>
              <div>
                {order.shippingAddress.district} / {order.shippingAddress.city}{' '}
                {order.shippingAddress.postalCode}
              </div>
              <div className="text-neutral-500">{order.shippingAddress.phone}</div>
            </div>
          )}
        </section>
        <section className="bg-white rounded-xl border p-6">
          <h3 className="font-bold mb-3">Ödeme</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-600">Ara toplam</span>
              <span className="font-mono">{formatTL(order.subtotalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Kargo</span>
              <span className="font-mono">{formatTL(order.shippingCents)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2 font-bold">
              <span>Toplam</span>
              <span className="font-mono">{formatTL(order.totalCents)}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Event log */}
      <section className="bg-white rounded-xl border p-6">
        <h3 className="font-bold mb-4">Olay Kaydı</h3>
        <div className="space-y-2 text-sm">
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 py-1">
              <div className="text-xs text-neutral-400 font-mono w-32 shrink-0">
                {e.occurredAt.toLocaleString('tr-TR')}
              </div>
              <div className="font-semibold w-40 shrink-0">{e.eventType}</div>
              <div className="text-neutral-600 text-xs flex-1">
                {e.actorType}: {e.actorId}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
