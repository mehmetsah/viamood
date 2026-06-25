import { count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { customers, orders } from '@/db/schema';
import { Pagination, parsePage } from '@/components/ui/Pagination';

const PAGE_SIZE = 25;

function formatTL(cents: number | bigint | string | null): string {
  const n = Number(cents ?? 0);
  return `${(n / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

interface PageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const q = (sp.q ?? '').trim();
  const search = q
    ? or(
        ilike(customers.email, `%${q}%`),
        ilike(customers.name, `%${q}%`),
        ilike(customers.phone, `%${q}%`),
      )
    : undefined;

  const [cnt] = await db.select({ total: count() }).from(customers).where(search);
  const total = cnt?.total ?? 0;

  const rows = await db
    .select({
      id: customers.id,
      email: customers.email,
      name: customers.name,
      phone: customers.phone,
      createdAt: customers.createdAt,
      orderCount: count(orders.id),
      totalSpent: sql<string>`coalesce(sum(${orders.totalCents}), 0)`,
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerEmail, customers.email))
    .where(search)
    .groupBy(customers.id)
    .orderBy(desc(customers.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Müşteriler</h1>
          <p className="text-sm text-neutral-500 mt-1">{total} kayıtlı müşteri</p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="E-posta, isim veya telefon ara…"
            className="h-10 w-72 px-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-[var(--color-brand-orange)]"
          />
          <button className="h-10 px-4 rounded-lg bg-[var(--color-brand-ink)] text-white text-sm font-medium">
            Ara
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Müşteri</th>
              <th className="text-left px-4 py-3 font-medium">Telefon</th>
              <th className="text-right px-4 py-3 font-medium">Sipariş</th>
              <th className="text-right px-4 py-3 font-medium">Toplam harcama</th>
              <th className="text-left px-4 py-3 font-medium">Kayıt</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-neutral-500">
                  {q ? 'Eşleşen müşteri yok.' : 'Henüz müşteri yok.'}
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="border-t hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/customers/${c.id}`} className="font-medium text-[var(--color-brand-orange)] hover:underline">
                    {c.name || '(isimsiz)'}
                  </Link>
                  <div className="text-xs text-neutral-500">{c.email}</div>
                </td>
                <td className="px-4 py-3 text-neutral-700">{c.phone || '-'}</td>
                <td className="px-4 py-3 text-right">{c.orderCount}</td>
                <td className="px-4 py-3 text-right font-medium">{formatTL(c.totalSpent)}</td>
                <td className="px-4 py-3 text-neutral-500">
                  {c.createdAt ? new Date(c.createdAt).toLocaleDateString('tr-TR') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination totalCount={total} currentPage={page} pageSize={PAGE_SIZE} searchParams={sp} />
    </div>
  );
}
