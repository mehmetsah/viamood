import { count, desc, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { productBundles, vendors } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { Pagination, parsePage } from '@/components/ui/Pagination';

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Taslak', cls: 'bg-neutral-200 text-neutral-700' },
  active: { label: 'Yayında', cls: 'bg-green-100 text-green-900' },
  archived: { label: 'Arşiv', cls: 'bg-orange-100 text-orange-900' },
};

function formatTL(cents: bigint | null): string {
  if (cents == null) return '-';
  return `${(Number(cents) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminBundlesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = parsePage(sp.page);

  const where = isNull(productBundles.deletedAt);
  const cntRes = await db.select({ total: count() }).from(productBundles).where(where);
  const total = cntRes[0]?.total ?? 0;

  const list = await db
    .select({
      id: productBundles.id,
      title: productBundles.title,
      sku: productBundles.sku,
      vendorId: productBundles.vendorId,
      displayVendorName: productBundles.displayVendorName,
      status: productBundles.status,
      bundlePriceCents: productBundles.bundlePriceCents,
      inventoryQuantity: productBundles.inventoryQuantity,
      imageUrl: productBundles.featuredImageUrl,
      shopifyProductId: productBundles.shopifyProductId,
      vendorName: vendors.name,
    })
    .from(productBundles)
    .leftJoin(vendors, eq(vendors.id, productBundles.vendorId))
    .where(where)
    .orderBy(desc(productBundles.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  // Karma vs vendor sayıları
  const breakdown = await db
    .select({
      isMixed: sql<boolean>`${productBundles.vendorId} IS NULL`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(productBundles)
    .where(where)
    .groupBy(sql`${productBundles.vendorId} IS NULL`);

  const mixedCount = breakdown.find((b) => b.isMixed)?.count ?? 0;
  const vendorCount = breakdown.find((b) => !b.isMixed)?.count ?? 0;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold">Set Ürünler</h1>
          <p className="text-neutral-600 text-sm mt-1">
            {total} toplam · {vendorCount} vendor seti · {mixedCount} karma (Via Mood seçkisi)
          </p>
        </div>
        <Link
          href="/admin/bundles/new"
          className="px-5 py-2.5 bg-[var(--color-brand-ink)] text-white rounded-full font-semibold text-sm"
        >
          + Karma Set Yarat
        </Link>
      </div>

      <p className="text-xs text-neutral-500 mb-6">
        Karma set = farklı vendor'ların ürünlerinden Via Mood adına oluşturulan seçki.
      </p>

      {total === 0 ? (
        <div className="bg-white rounded-xl p-16 border text-center text-neutral-500">
          Henüz set yok
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Set</th>
                <th className="text-left px-4 py-3 font-semibold">Tedarikçi</th>
                <th className="text-left px-4 py-3 font-semibold w-28">Durum</th>
                <th className="text-right px-4 py-3 font-semibold w-32">Fiyat</th>
                <th className="text-right px-4 py-3 font-semibold w-20">Stok</th>
                <th className="text-center px-4 py-3 font-semibold w-24">Shopify</th>
                <th className="text-right px-4 py-3 font-semibold w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((b) => {
                const st = STATUS_LABEL[b.status] ?? STATUS_LABEL.draft!;
                const isMixed = !b.vendorId;
                return (
                  <tr key={b.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {b.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.imageUrl} alt="" className="w-10 h-10 object-cover rounded" />
                        ) : (
                          <div className="w-10 h-10 bg-neutral-100 rounded flex items-center justify-center">🎁</div>
                        )}
                        <div>
                          <div className="font-semibold">{b.title}</div>
                          <div className="text-xs text-neutral-500 font-mono">{b.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isMixed ? (
                        <span className="inline-block bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded">
                          Karma · Via Mood
                        </span>
                      ) : (
                        <span className="text-sm">{b.vendorName ?? b.displayVendorName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatTL(b.bundlePriceCents)}</td>
                    <td className="px-4 py-3 text-right">{b.inventoryQuantity}</td>
                    <td className="px-4 py-3 text-center">
                      {b.shopifyProductId ? (
                        <span className="text-green-700 text-xs">✓</span>
                      ) : (
                        <span className="text-neutral-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/bundles/${b.id}`}
                        className="text-[var(--color-brand-orange)] font-semibold hover:underline text-sm"
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
