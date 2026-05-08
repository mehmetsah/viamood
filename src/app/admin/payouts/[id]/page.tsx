import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { commissionLedger, orderLineItems, orders, payouts, vendors } from '@/db/schema';
import {
  approvePayoutAction,
  cancelPayoutAction,
  markPayoutPaidAction,
} from '@/lib/actions/payout';

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Taslak', cls: 'bg-neutral-200 text-neutral-700' },
  approved: { label: 'Onaylı', cls: 'bg-blue-100 text-blue-900' },
  processing: { label: 'İşleniyor', cls: 'bg-yellow-100 text-yellow-900' },
  paid: { label: 'Ödendi', cls: 'bg-green-100 text-green-900' },
  cancelled: { label: 'İptal', cls: 'bg-neutral-200 text-neutral-700' },
  failed: { label: 'Başarısız', cls: 'bg-red-100 text-red-900' },
};

function formatTL(cents: bigint): string {
  return `${(Number(cents) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

export default async function PayoutDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [payout] = await db
    .select({
      payout: payouts,
      vendor: vendors,
    })
    .from(payouts)
    .innerJoin(vendors, eq(vendors.id, payouts.vendorId))
    .where(eq(payouts.id, id))
    .limit(1);

  if (!payout) notFound();

  const { payout: p, vendor } = payout;

  const ledger = await db
    .select({
      ledger: commissionLedger,
      orderName: orders.shopifyOrderName,
      itemTitle: orderLineItems.title,
    })
    .from(commissionLedger)
    .leftJoin(orders, eq(orders.id, commissionLedger.orderId))
    .leftJoin(orderLineItems, eq(orderLineItems.id, commissionLedger.orderLineItemId))
    .where(eq(commissionLedger.payoutBatchId, id))
    .orderBy(asc(commissionLedger.createdAt));

  const status = STATUS_LABELS[p.status]!;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/admin/payouts" className="text-sm text-neutral-600 hover:underline">
        ← Payouts
      </Link>

      <div className="flex items-start justify-between mt-2 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Payout Batch</h1>
          <p className="text-neutral-600 text-sm mt-1">
            {vendor.name} · {p.periodStart.toLocaleDateString('tr-TR')} —{' '}
            {p.periodEnd.toLocaleDateString('tr-TR')}
          </p>
        </div>
        <span className={`text-sm font-bold px-3 py-1.5 rounded ${status.cls}`}>{status.label}</span>
      </div>

      {/* Summary */}
      <section className="bg-white rounded-xl border p-6 mb-6">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-xs text-neutral-500">Brüt</div>
            <div className="text-xl font-bold font-mono mt-1">{formatTL(p.grossAmountCents)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Komisyon</div>
            <div className="text-xl font-bold font-mono mt-1 text-red-700">
              −{formatTL(p.commissionAmountCents)}
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Net (vendor'a)</div>
            <div className="text-2xl font-bold font-mono mt-1 text-green-700">
              {formatTL(p.netAmountCents)}
            </div>
          </div>
        </div>
        {p.bankIban && (
          <div className="border-t mt-4 pt-4 text-sm space-y-1">
            <div>
              <strong>Hesap sahibi:</strong> {p.bankAccountHolder}
            </div>
            <div>
              <strong>IBAN:</strong> <code className="font-mono">{p.bankIban}</code>
            </div>
          </div>
        )}
        {p.note && (
          <div className="border-t mt-4 pt-4 text-sm text-neutral-600">{p.note}</div>
        )}
        {p.externalReference && (
          <div className="border-t mt-4 pt-4 text-sm">
            <strong>Banka referansı:</strong> <code className="font-mono">{p.externalReference}</code>
          </div>
        )}
      </section>

      {/* Actions */}
      {p.status === 'draft' && (
        <section className="bg-white rounded-xl border p-6 mb-6 flex gap-3">
          <form action={approvePayoutAction}>
            <input type="hidden" name="payoutId" value={p.id} />
            <button
              type="submit"
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
            >
              ✓ Onayla
            </button>
          </form>
          <form action={cancelPayoutAction}>
            <input type="hidden" name="payoutId" value={p.id} />
            <button
              type="submit"
              className="px-5 py-2.5 border border-neutral-300 rounded-lg font-semibold hover:bg-neutral-100"
            >
              İptal et (ledger'ı serbest bırak)
            </button>
          </form>
        </section>
      )}

      {p.status === 'approved' && (
        <section className="bg-white rounded-xl border p-6 mb-6">
          <h3 className="font-bold mb-3">Ödeme yapıldı mı?</h3>
          <form action={markPayoutPaidAction} className="flex gap-3">
            <input type="hidden" name="payoutId" value={p.id} />
            <input
              name="externalReference"
              placeholder="Banka referans no (opsiyonel)"
              className="flex-1 h-11 px-4 border rounded-lg text-sm"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
            >
              💸 Paid olarak işaretle
            </button>
          </form>
        </section>
      )}

      {/* Ledger entries */}
      <h2 className="font-bold text-lg mb-4">Hak Ediş Kalemleri ({ledger.length})</h2>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Sipariş</th>
              <th className="text-left px-4 py-3 font-semibold">Ürün</th>
              <th className="text-right px-4 py-3 font-semibold">Brüt</th>
              <th className="text-right px-4 py-3 font-semibold">Komisyon</th>
              <th className="text-right px-4 py-3 font-semibold">Net</th>
              <th className="text-right px-4 py-3 font-semibold">Tarih</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ledger.map((row) => (
              <tr key={row.ledger.id}>
                <td className="px-4 py-3 font-mono text-xs">{row.orderName ?? '—'}</td>
                <td className="px-4 py-3 text-sm">{row.itemTitle ?? '—'}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatTL(row.ledger.grossAmountCents)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-red-700 text-xs">
                  −{formatTL(row.ledger.commissionAmountCents)} ({row.ledger.commissionRateBps / 100}%)
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold">
                  {formatTL(row.ledger.payoutAmountCents)}
                </td>
                <td className="px-4 py-3 text-right text-xs text-neutral-500">
                  {row.ledger.createdAt.toLocaleDateString('tr-TR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
