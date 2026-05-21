import { and, count, desc, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { productBundles, vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';
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

export default async function VendorBundlesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = parsePage(sp.page);

  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');

  const [membership] = await db
    .select({ vendorId: vendors.id, status: vendors.status, name: vendors.name })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) redirect('/onboarding');

  const isActive = membership.status === 'active';
  const where = and(eq(productBundles.vendorId, membership.vendorId), isNull(productBundles.deletedAt));

  const cntRes = await db.select({ total: count() }).from(productBundles).where(where);
  const total = cntRes[0]?.total ?? 0;

  const list = await db
    .select()
    .from(productBundles)
    .where(where)
    .orderBy(desc(productBundles.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Set Ürünler</h1>
          <p className="text-neutral-600 text-sm mt-1">
            {total} set · Birden fazla ürünü tek SKU + özel fiyatla satma
          </p>
        </div>
        <Link
          href={isActive ? '/bundles/new' : '#'}
          className={`inline-flex items-center px-5 py-2.5 rounded-full font-semibold text-[15px] ${
            isActive
              ? 'bg-[var(--color-brand-ink)] text-white hover:opacity-90'
              : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
          }`}
          aria-disabled={!isActive}
        >
          + Yeni Set
        </Link>
      </div>

      {total === 0 ? (
        <div className="bg-white rounded-xl p-16 border text-center">
          <div className="text-5xl mb-3">🎁</div>
          <h2 className="font-bold mb-2">Henüz set yok</h2>
          <p className="text-neutral-600 text-sm mb-6 max-w-md mx-auto">
            Ürünlerini birleştir, özel fiyatla "Set" olarak sat. Hediyelik veya kampanya
            paketleri için ideal.
          </p>
          {isActive && (
            <Link
              href="/bundles/new"
              className="inline-flex px-5 py-2.5 bg-[var(--color-brand-ink)] text-white rounded-full font-semibold text-sm"
            >
              + İlk seti yarat
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Set</th>
                <th className="text-left px-4 py-3 font-semibold w-28">Durum</th>
                <th className="text-right px-4 py-3 font-semibold w-32">Set Fiyatı</th>
                <th className="text-right px-4 py-3 font-semibold w-24">Stok</th>
                <th className="text-right px-4 py-3 font-semibold w-32">Eylem</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((b) => {
                const st = STATUS_LABEL[b.status] ?? STATUS_LABEL.draft!;
                return (
                  <tr key={b.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {b.featuredImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={b.featuredImageUrl}
                            alt=""
                            className="w-10 h-10 object-cover rounded border"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-neutral-100 rounded border flex items-center justify-center text-neutral-400">
                            🎁
                          </div>
                        )}
                        <div>
                          <div className="font-semibold">{b.title}</div>
                          <div className="text-xs text-neutral-500 font-mono">{b.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatTL(b.bundlePriceCents)}</td>
                    <td className="px-4 py-3 text-right">{b.inventoryQuantity}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/bundles/${b.id}`}
                        className="text-[var(--color-brand-orange)] font-semibold hover:underline text-sm"
                      >
                        Düzenle →
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
