import { count, desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { orders, routingDecisions } from '@/db/schema';
import { Pagination, parsePage } from '@/components/ui/Pagination';

const PAGE_SIZE = 25;

const FIN_LABEL: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Ödendi', cls: 'bg-green-100 text-green-900' },
  pending: { label: 'Bekliyor', cls: 'bg-yellow-100 text-yellow-900' },
  authorized: { label: 'Yetkilendirildi', cls: 'bg-blue-100 text-blue-900' },
  refunded: { label: 'İade', cls: 'bg-red-100 text-red-900' },
  partially_refunded: { label: 'Kısmi iade', cls: 'bg-orange-100 text-orange-900' },
  partially_paid: { label: 'Kısmi ödeme', cls: 'bg-orange-100 text-orange-900' },
  voided: { label: 'İptal', cls: 'bg-neutral-200 text-neutral-700' },
};

const FUL_LABEL: Record<string, { label: string; cls: string }> = {
  unfulfilled: { label: 'Hazırlanıyor', cls: 'bg-yellow-100 text-yellow-900' },
  partial: { label: 'Kısmi', cls: 'bg-orange-100 text-orange-900' },
  fulfilled: { label: 'Tamamlandı', cls: 'bg-green-100 text-green-900' },
  restocked: { label: 'Stoğa iade', cls: 'bg-neutral-200 text-neutral-700' },
};

const MODE_LABEL: Record<string, string> = {
  split: '↗ Split',
  consolidate_self: '⊕ Biz topluyor',
  consolidate_carrier: '⊕ Kargocu topluyor',
};

function formatTL(cents: bigint | null): string {
  if (!cents) return '-';
  return `${(Number(cents) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = parsePage(sp.page);

  const _cnt_total = await db .select({ total: count() }).from(orders);
  const total = _cnt_total[0]?.total ?? 0;

  const list = await db
    .select({
      id: orders.id,
      shopifyOrderName: orders.shopifyOrderName,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      totalCents: orders.totalCents,
      financialStatus: orders.financialStatus,
      fulfillmentStatus: orders.fulfillmentStatus,
      vendorCount: orders.vendorCount,
      placedAt: orders.placedAt,
      sourceName: orders.sourceName,
      routingMode: routingDecisions.mode,
    })
    .from(orders)
    .leftJoin(routingDecisions, eq(routingDecisions.orderId, orders.id))
    .orderBy(desc(orders.placedAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Tüm Siparişler</h1>
          <p className="text-neutral-600 text-sm mt-1">{total} sipariş</p>
        </div>
        <Link
          href="/admin/orders/new"
          className="px-5 py-2.5 bg-[var(--color-brand-ink)] text-white rounded-full font-semibold text-sm"
        >
          + Test Sipariş
        </Link>
      </div>

      {total === 0 ? (
        <div className="bg-white rounded-xl p-16 border text-center">
          <div className="text-5xl mb-3">🛒</div>
          <h2 className="font-bold mb-2">Henüz sipariş yok</h2>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Sipariş</th>
                <th className="text-left px-4 py-3 font-semibold">Müşteri</th>
                <th className="text-left px-4 py-3 font-semibold">Vendor</th>
                <th className="text-left px-4 py-3 font-semibold">Routing</th>
                <th className="text-left px-4 py-3 font-semibold">Ödeme</th>
                <th className="text-left px-4 py-3 font-semibold">Fulfillment</th>
                <th className="text-right px-4 py-3 font-semibold">Tutar</th>
                <th className="text-right px-4 py-3 font-semibold">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((o) => {
                const fin = FIN_LABEL[o.financialStatus];
                const ful = FUL_LABEL[o.fulfillmentStatus];
                return (
                  <tr key={o.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-mono font-semibold text-[var(--color-brand-orange)] hover:underline"
                      >
                        {o.shopifyOrderName}
                      </Link>
                      {o.sourceName === 'admin_test' && (
                        <div className="text-xs text-neutral-400 mt-0.5">Test sipariş</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm">{o.customerName}</div>
                      <div className="text-xs text-neutral-500">{o.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{o.vendorCount}</td>
                    <td className="px-4 py-3 text-xs">
                      {o.routingMode ? MODE_LABEL[o.routingMode] : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {fin && <span className={`text-xs font-bold px-2 py-1 rounded ${fin.cls}`}>{fin.label}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {ful && <span className={`text-xs font-bold px-2 py-1 rounded ${ful.cls}`}>{ful.label}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {formatTL(o.totalCents)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-neutral-500">
                      {o.placedAt.toLocaleDateString('tr-TR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            totalCount={total}
            currentPage={page}
            pageSize={PAGE_SIZE}
            searchParams={sp}
          />
        </div>
      )}
    </div>
  );
}
