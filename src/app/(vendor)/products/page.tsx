import { and, desc, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { products, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';
import { vendorMemberships } from '@/db/schema';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: 'Yayında', cls: 'bg-green-100 text-green-900' },
  draft: { label: 'Taslak', cls: 'bg-neutral-200 text-neutral-700' },
  archived: { label: 'Arşiv', cls: 'bg-orange-100 text-orange-900' },
};

function formatTL(cents: bigint | null): string {
  if (!cents) return '-';
  return `${(Number(cents) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;
}

export default async function ProductsListPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');

  // Vendor lookup
  const [membership] = await db
    .select({ vendorId: vendors.id, status: vendors.status, name: vendors.name })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) redirect('/onboarding');

  const isActive = membership.status === 'active';

  const list = await db
    .select()
    .from(products)
    .where(and(eq(products.vendorId, membership.vendorId), isNull(products.deletedAt)))
    .orderBy(desc(products.createdAt))
    .limit(100);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Ürünler</h1>
          <p className="text-neutral-600 text-sm mt-1">{list.length} ürün</p>
        </div>
        <Link
          href={isActive ? '/products/new' : '#'}
          className={`inline-flex items-center px-5 py-2.5 rounded-full font-semibold text-[15px] ${
            isActive
              ? 'bg-[var(--color-brand-ink)] text-white hover:opacity-90'
              : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
          }`}
          aria-disabled={!isActive}
        >
          + Yeni Ürün
        </Link>
      </div>

      {!isActive && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-sm text-yellow-900">
          Tedarikçi durumun <strong>{membership.status}</strong>. Ürün ekleyebilmen için aktif olman gerek.
        </div>
      )}

      {list.length === 0 ? (
        <div className="bg-white rounded-xl p-16 border text-center">
          <div className="text-5xl mb-3">📦</div>
          <h2 className="font-bold mb-2">Henüz ürün yok</h2>
          <p className="text-neutral-600 text-sm mb-6">
            İlk ürününü ekleyerek satışa başla.
          </p>
          {isActive && (
            <Link
              href="/products/new"
              className="inline-flex px-5 py-2.5 bg-[var(--color-brand-ink)] text-white rounded-full font-semibold text-sm"
            >
              + İlk ürünü ekle
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Ürün</th>
                <th className="text-left px-4 py-3 font-semibold w-28">Durum</th>
                <th className="text-right px-4 py-3 font-semibold w-32">Fiyat</th>
                <th className="text-right px-4 py-3 font-semibold w-24">Stok</th>
                <th className="text-right px-4 py-3 font-semibold w-32">Eylem</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((p) => {
                const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.draft!;
                return (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.featuredImageUrl ? (
                          <img
                            src={p.featuredImageUrl}
                            alt=""
                            className="w-10 h-10 object-cover rounded border"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-neutral-100 rounded border flex items-center justify-center text-neutral-400 text-xs">
                            📦
                          </div>
                        )}
                        <div>
                          <div className="font-semibold">{p.title}</div>
                          {p.productType && (
                            <div className="text-xs text-neutral-500">{p.productType}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatTL(p.minPriceCents)}</td>
                    <td className="px-4 py-3 text-right">{p.totalInventory}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/products/${p.id}`}
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
        </div>
      )}
    </div>
  );
}
