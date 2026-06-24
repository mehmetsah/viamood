import Link from 'next/link';
import { desc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { getSessionCustomer } from '@/lib/customers/session';

export const dynamic = 'force-dynamic';

function formatTRY(cents: bigint | number): string {
  return (Number(cents) / 100).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
}

const FIN_LABEL: Record<string, string> = {
  pending: 'Ödeme bekliyor',
  authorized: 'Onaylandı',
  paid: 'Ödendi',
  partially_paid: 'Kısmi ödendi',
  refunded: 'İade edildi',
  partially_refunded: 'Kısmi iade',
  voided: 'İptal',
};
const FUL_LABEL: Record<string, string> = {
  unfulfilled: 'Hazırlanıyor',
  partial: 'Kısmen kargolandı',
  fulfilled: 'Kargolandı',
  restocked: 'İade/stok',
};

type RawLineItem = { title?: string; quantity?: number; variant_title?: string | null };

export default async function SiparislerimPage() {
  const customer = await getSessionCustomer();

  const list = customer
    ? await db
        .select()
        .from(orders)
        .where(
          or(
            eq(sql`lower(${orders.customerEmail})`, customer.email),
            customer.shopifyCustomerId
              ? eq(orders.customerId, customer.shopifyCustomerId)
              : sql`false`,
          ),
        )
        .orderBy(desc(orders.placedAt))
        .limit(100)
    : [];

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Siparişlerim</h1>
      <p className="text-sm text-neutral-500 mb-6">Geçmiş siparişlerin ve durumları</p>

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border p-10 text-center">
          <p className="text-neutral-600">Henüz siparişin yok.</p>
          <Link
            href="https://viamood.com.tr"
            className="inline-block mt-4 text-[var(--color-brand-orange)] font-semibold hover:underline"
          >
            Alışverişe başla →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((o) => {
            const items =
              ((o.rawShopifyPayload as { line_items?: RawLineItem[] } | null)?.line_items) ?? [];
            return (
              <div key={o.id} className="bg-white rounded-2xl border p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold">{o.shopifyOrderName}</div>
                    <div className="text-xs text-neutral-500">
                      {new Date(o.placedAt).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatTRY(o.totalCents)}</div>
                    <div className="flex gap-1.5 mt-1 justify-end">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                        {FIN_LABEL[o.financialStatus] ?? o.financialStatus}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        {FUL_LABEL[o.fulfillmentStatus] ?? o.fulfillmentStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {items.length > 0 && (
                  <ul className="mt-4 pt-4 border-t flex flex-col gap-1.5 text-sm">
                    {items.map((li, i) => (
                      <li key={i} className="flex justify-between gap-3 text-neutral-700">
                        <span>
                          {li.title}
                          {li.variant_title && li.variant_title !== 'Default Title' && li.variant_title !== 'Default' ? (
                            <span className="text-neutral-400"> · {li.variant_title}</span>
                          ) : null}
                        </span>
                        <span className="text-neutral-400 shrink-0">× {li.quantity ?? 1}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
