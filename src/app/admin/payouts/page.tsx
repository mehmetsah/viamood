import { count, desc, eq, isNull, sql, and } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { commissionLedger, payouts, vendors } from '@/db/schema';
import { Pagination, parsePage } from '@/components/ui/Pagination';

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Taslak', cls: 'bg-neutral-200 text-neutral-700' },
  approved: { label: 'Onaylı', cls: 'bg-blue-100 text-blue-900' },
  processing: { label: 'İşleniyor', cls: 'bg-yellow-100 text-yellow-900' },
  paid: { label: 'Ödendi', cls: 'bg-green-100 text-green-900' },
  failed: { label: 'Başarısız', cls: 'bg-red-100 text-red-900' },
  cancelled: { label: 'İptal', cls: 'bg-neutral-200 text-neutral-700' },
};

const METHOD_LABELS: Record<string, string> = {
  iyzico_split: 'Iyzico Split',
  iyzico_transfer: 'Iyzico Transfer',
  manual_bank: 'Manuel Banka',
  paytr_bk: 'PayTR BK',
};

function formatTL(cents: bigint): string {
  return `${(Number(cents) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminPayoutsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = parsePage(sp.page);

  const _cnt_total = await db .select({ total: count() }).from(payouts);
  const total = _cnt_total[0]?.total ?? 0;

  const list = await db
    .select({
      id: payouts.id,
      vendorId: payouts.vendorId,
      vendorName: vendors.name,
      method: payouts.method,
      status: payouts.status,
      periodStart: payouts.periodStart,
      periodEnd: payouts.periodEnd,
      netAmountCents: payouts.netAmountCents,
      paidAt: payouts.paidAt,
      createdAt: payouts.createdAt,
    })
    .from(payouts)
    .innerJoin(vendors, eq(vendors.id, payouts.vendorId))
    .orderBy(desc(payouts.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  // Vendor bazında 'accrued' bekleyen toplam (yeni batch için ipucu)
  const pendingAgg = await db
    .select({
      vendorId: commissionLedger.vendorId,
      vendorName: vendors.name,
      pending: sql<string>`COALESCE(SUM(${commissionLedger.payoutAmountCents}), 0)::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(commissionLedger)
    .innerJoin(vendors, eq(vendors.id, commissionLedger.vendorId))
    .where(and(eq(commissionLedger.status, 'accrued'), isNull(commissionLedger.payoutBatchId)))
    .groupBy(commissionLedger.vendorId, vendors.name);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Ödemeler (Payouts)</h1>
          <p className="text-neutral-600 text-sm mt-1">{total} payout</p>
        </div>
        <Link
          href="/admin/payouts/new"
          className="px-5 py-2.5 bg-[var(--color-brand-ink)] text-white rounded-full font-semibold text-sm"
        >
          + Yeni Batch
        </Link>
      </div>

      {/* Bekleyen hak edişler */}
      {pendingAgg.length > 0 && (
        <section className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-8">
          <h2 className="font-bold text-yellow-900 mb-3">
            ⏳ Bekleyen hak edişler (henüz batch'lenmedi)
          </h2>
          <div className="space-y-1 text-sm">
            {pendingAgg.map((p) => (
              <div key={p.vendorId} className="flex justify-between">
                <span>{p.vendorName} · {p.count} kayıt</span>
                <span className="font-mono font-bold text-yellow-900">{formatTL(BigInt(p.pending))}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {total === 0 ? (
        <div className="bg-white rounded-xl p-16 border text-center">
          <div className="text-5xl mb-3">💰</div>
          <h2 className="font-bold mb-2">Henüz payout yok</h2>
          <p className="text-neutral-600 text-sm mb-6">
            Vendor'ların hak ediş kayıtları biriktiğinde batch oluşturup onaylayabilirsin.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Vendor</th>
                <th className="text-left px-4 py-3 font-semibold">Periyot</th>
                <th className="text-left px-4 py-3 font-semibold">Yöntem</th>
                <th className="text-right px-4 py-3 font-semibold">Tutar</th>
                <th className="text-left px-4 py-3 font-semibold">Durum</th>
                <th className="text-right px-4 py-3 font-semibold">Oluşturma</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((p) => {
                const st = STATUS_LABELS[p.status]!;
                return (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-semibold">{p.vendorName}</td>
                    <td className="px-4 py-3 text-xs text-neutral-600">
                      {p.periodStart.toLocaleDateString('tr-TR')} —{' '}
                      {p.periodEnd.toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-4 py-3 text-xs">{METHOD_LABELS[p.method]}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {formatTL(p.netAmountCents)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-neutral-500">
                      {p.createdAt.toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/payouts/${p.id}`}
                        className="text-[var(--color-brand-orange)] font-semibold text-sm hover:underline"
                      >
                        Aç →
                      </Link>
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
