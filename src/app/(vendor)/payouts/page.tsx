import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { commissionLedger, orders, payouts, vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Taslak', cls: 'bg-neutral-200 text-neutral-700' },
  approved: { label: 'Onaylı', cls: 'bg-blue-100 text-blue-900' },
  processing: { label: 'İşleniyor', cls: 'bg-yellow-100 text-yellow-900' },
  paid: { label: 'Ödendi', cls: 'bg-green-100 text-green-900' },
  cancelled: { label: 'İptal', cls: 'bg-neutral-200 text-neutral-700' },
};

function formatTL(cents: bigint | string | number): string {
  return `${(Number(cents) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

export default async function VendorPayoutsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');

  const [membership] = await db
    .select({ vendorId: vendors.id })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) redirect('/onboarding');

  // Bekleyen hak ediş (henüz batch'e alınmamış)
  const [pending] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${commissionLedger.payoutAmountCents}), 0)::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(commissionLedger)
    .where(
      and(
        eq(commissionLedger.vendorId, membership.vendorId),
        eq(commissionLedger.status, 'accrued'),
        isNull(commissionLedger.payoutBatchId),
      ),
    );

  // Geçmiş payout'lar
  const list = await db
    .select()
    .from(payouts)
    .where(eq(payouts.vendorId, membership.vendorId))
    .orderBy(desc(payouts.createdAt))
    .limit(50);

  // Son sipariş hak edişleri
  const recentLedger = await db
    .select({
      ledger: commissionLedger,
      orderName: orders.shopifyOrderName,
    })
    .from(commissionLedger)
    .leftJoin(orders, eq(orders.id, commissionLedger.orderId))
    .where(eq(commissionLedger.vendorId, membership.vendorId))
    .orderBy(desc(commissionLedger.createdAt))
    .limit(20);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Ödemeler</h1>
      <p className="text-neutral-600 text-sm mb-8">Hak edişlerin ve banka aktarım geçmişin</p>

      {/* Bekleyen hak ediş */}
      <section className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-yellow-900 font-semibold">Bekleyen hak ediş</div>
            <div className="text-3xl font-bold font-mono mt-1">{formatTL(pending?.total ?? '0')}</div>
            <div className="text-xs text-yellow-800 mt-1">{pending?.count ?? 0} kayıt</div>
          </div>
          <div className="text-right text-xs text-yellow-800 max-w-xs">
            Bu tutar henüz batch'lenmedi. Admin periyot sonu batch oluşturduğunda burada görünecek.
          </div>
        </div>
      </section>

      {/* Payout history */}
      <h2 className="font-bold mb-4">Payout Geçmişi</h2>
      {list.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border text-center text-sm text-neutral-500 mb-8">
          Henüz payout kaydı yok
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Periyot</th>
                <th className="text-right px-4 py-3 font-semibold">Brüt</th>
                <th className="text-right px-4 py-3 font-semibold">Komisyon</th>
                <th className="text-right px-4 py-3 font-semibold">Net</th>
                <th className="text-left px-4 py-3 font-semibold">Durum</th>
                <th className="text-right px-4 py-3 font-semibold">Ödeme</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((p) => {
                const st = STATUS_LABELS[p.status]!;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-xs">
                      {p.periodStart.toLocaleDateString('tr-TR')} —{' '}
                      {p.periodEnd.toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatTL(p.grossAmountCents)}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-700 text-xs">
                      −{formatTL(p.commissionAmountCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {formatTL(p.netAmountCents)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-neutral-500">
                      {p.paidAt ? p.paidAt.toLocaleDateString('tr-TR') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent ledger */}
      <h2 className="font-bold mb-4">Son 20 Hak Ediş Kaydı</h2>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Sipariş</th>
              <th className="text-right px-4 py-3 font-semibold">Brüt</th>
              <th className="text-right px-4 py-3 font-semibold">Net</th>
              <th className="text-left px-4 py-3 font-semibold">Durum</th>
              <th className="text-right px-4 py-3 font-semibold">Tarih</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {recentLedger.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  Henüz satış yok
                </td>
              </tr>
            ) : (
              recentLedger.map((row) => (
                <tr key={row.ledger.id}>
                  <td className="px-4 py-3 font-mono text-xs">{row.orderName ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatTL(row.ledger.grossAmountCents)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {formatTL(row.ledger.payoutAmountCents)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="px-2 py-1 rounded bg-neutral-100">{row.ledger.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-neutral-500">
                    {row.ledger.createdAt.toLocaleDateString('tr-TR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
