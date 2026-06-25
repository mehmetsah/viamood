import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { customerAddresses, customers, orders } from '@/db/schema';

function formatTL(cents: number | bigint | null): string {
  return `${(Number(cents ?? 0) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

const FIN: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Ödendi', cls: 'bg-green-100 text-green-900' },
  pending: { label: 'Bekliyor', cls: 'bg-yellow-100 text-yellow-900' },
  authorized: { label: 'Yetkilendirildi', cls: 'bg-blue-100 text-blue-900' },
  refunded: { label: 'İade', cls: 'bg-red-100 text-red-900' },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) notFound();

  const addresses = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, id));

  const orderRows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      shopifyOrderName: orders.shopifyOrderName,
      totalCents: orders.totalCents,
      financialStatus: orders.financialStatus,
      placedAt: orders.placedAt,
      backend: orders.backend,
    })
    .from(orders)
    .where(eq(orders.customerEmail, customer.email))
    .orderBy(desc(orders.placedAt))
    .limit(50);

  const totalSpent = orderRows.reduce((s, o) => s + Number(o.totalCents ?? 0), 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/admin/customers" className="text-sm text-neutral-600 hover:underline">
        ← Müşteriler
      </Link>
      <div className="flex items-center justify-between mt-2 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{customer.name || '(isimsiz müşteri)'}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {customer.email}
            {customer.phone ? ` · ${customer.phone}` : ''}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{formatTL(totalSpent)}</div>
          <div className="text-xs text-neutral-500">{orderRows.length} sipariş · toplam harcama</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Adresler */}
        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-bold border-b pb-2 mb-3">Adresler ({addresses.length})</h2>
          {addresses.length === 0 && <p className="text-sm text-neutral-500">Kayıtlı adres yok.</p>}
          <div className="flex flex-col gap-3">
            {addresses.map((a) => (
              <div key={a.id} className="text-sm border rounded-lg p-3">
                <div className="font-medium">
                  {[a.firstName, a.lastName].filter(Boolean).join(' ') || '(isimsiz)'}
                  {a.isDefault && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-100 text-green-800 rounded">varsayılan</span>
                  )}
                </div>
                <div className="text-neutral-600 mt-1">{a.address1}</div>
                <div className="text-neutral-500 text-xs mt-0.5">
                  {[a.neighborhood, a.district, a.province].filter(Boolean).join(' / ')}
                  {a.postalCode ? ` · ${a.postalCode}` : ''}
                </div>
                {a.phone && <div className="text-neutral-500 text-xs">{a.phone}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* Siparişler */}
        <section className="bg-white rounded-xl border p-5 col-span-2">
          <h2 className="font-bold border-b pb-2 mb-3">Siparişler ({orderRows.length})</h2>
          {orderRows.length === 0 && <p className="text-sm text-neutral-500">Henüz sipariş yok.</p>}
          <table className="w-full text-sm">
            <tbody>
              {orderRows.map((o) => {
                const fin = FIN[o.financialStatus ?? ''] ?? { label: o.financialStatus ?? '-', cls: 'bg-neutral-100 text-neutral-700' };
                return (
                  <tr key={o.id} className="border-t">
                    <td className="py-2 font-medium">
                      {o.orderNumber || o.shopifyOrderName || o.id.slice(0, 8)}
                      {o.backend === 'native' && <span className="ml-1 text-xs text-neutral-400">native</span>}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${fin.cls}`}>{fin.label}</span>
                    </td>
                    <td className="py-2 text-right font-medium">{formatTL(o.totalCents)}</td>
                    <td className="py-2 text-right text-neutral-500 text-xs">
                      {o.placedAt ? new Date(o.placedAt).toLocaleDateString('tr-TR') : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
