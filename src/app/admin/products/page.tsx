import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { productVariants, products, vendors } from '@/db/schema';
import { Pagination, parsePage } from '@/components/ui/Pagination';
import { AdminProductRowActions } from './AdminProductRowActions';

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    vendor?: string;
    status?: 'active' | 'draft' | 'archived' | 'all';
    pushed?: 'yes' | 'no' | 'all';
    page?: string;
  }>;
}

function fmtTL(cents: bigint | number | null | undefined): string {
  if (cents == null) return '—';
  return `${(Number(cents) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  draft: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-neutral-200 text-neutral-700',
};

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { q, vendor, status, pushed } = sp;
  const page = parsePage(sp.page);

  const vendorsList = await db
    .select({ id: vendors.id, name: vendors.name, slug: vendors.slug })
    .from(vendors)
    .where(eq(vendors.status, 'active'))
    .orderBy(vendors.name);

  const conditions = [];
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    conditions.push(or(ilike(products.title, like), ilike(productVariants.sku, like)));
  }
  if (vendor && vendor !== 'all') {
    conditions.push(eq(products.vendorId, vendor));
  }
  if (status && status !== 'all') {
    conditions.push(eq(products.status, status));
  }
  if (pushed === 'yes') {
    conditions.push(sql`${products.shopifyProductId} NOT LIKE 'local_%'`);
  } else if (pushed === 'no') {
    conditions.push(sql`${products.shopifyProductId} LIKE 'local_%'`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Total count
  const _cnt_total = await db .select({ total: count() })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(whereClause);
  const total = _cnt_total[0]?.total ?? 0;

  // Per-vendor pushed/unpushed quick stats (filtre-bağımsız)
  const allRows = await db
    .select({
      shopifyProductId: products.shopifyProductId,
      status: products.status,
    })
    .from(products);
  const totalAll = allRows.length;
  const totalPushed = allRows.filter((r) => !r.shopifyProductId.startsWith('local_')).length;
  const totalUnpushed = totalAll - totalPushed;
  const totalDraft = allRows.filter((r) => r.status === 'draft').length;

  // Paginated rows
  const rows = await db
    .select({
      id: products.id,
      title: products.title,
      productType: products.productType,
      status: products.status,
      vendorName: products.vendorName,
      shopifyProductId: products.shopifyProductId,
      shopifyHandle: products.shopifyHandle,
      featuredImageUrl: products.featuredImageUrl,
      minPriceCents: products.minPriceCents,
      totalInventory: products.totalInventory,
      sku: productVariants.sku,
      createdAt: products.createdAt,
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(whereClause)
    .orderBy(desc(products.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <h1 className="text-3xl font-bold">Tüm Ürünler</h1>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-sm text-neutral-600 flex gap-4">
            <span><strong className="text-neutral-900">{totalAll}</strong> toplam</span>
            <span className="text-green-700"><strong>{totalPushed}</strong> Shopify'da</span>
            <span className="text-yellow-700"><strong>{totalUnpushed}</strong> bekliyor</span>
            <span className="text-orange-700"><strong>{totalDraft}</strong> taslak</span>
          </div>
          <Link
            href={vendor && vendor !== 'all' ? `/admin/products/new?vendor=${vendor}` : '/admin/products/new'}
            className="px-4 py-2 bg-[var(--color-brand-orange)] text-white rounded-lg font-semibold text-sm hover:opacity-90 whitespace-nowrap"
          >
            + Yeni Ürün
          </Link>
        </div>
      </div>
      <p className="text-neutral-600 text-sm mb-6">
        Filtre ↓ uyguladığınızda eşleşen <strong>{total}</strong> kayıt.
      </p>

      <form className="bg-white rounded-xl border p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
        <input
          type="text"
          name="q"
          placeholder="Başlık veya SKU ara…"
          defaultValue={q ?? ''}
          className="md:col-span-2 border rounded-lg px-3 py-2"
        />
        <select name="vendor" defaultValue={vendor ?? 'all'} className="border rounded-lg px-3 py-2">
          <option value="all">Tüm vendorlar</option>
          {vendorsList.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? 'all'} className="border rounded-lg px-3 py-2">
          <option value="all">Tüm durumlar</option>
          <option value="active">Aktif</option>
          <option value="draft">Taslak</option>
          <option value="archived">Arşivlenmiş</option>
        </select>
        <select name="pushed" defaultValue={pushed ?? 'all'} className="border rounded-lg px-3 py-2">
          <option value="all">Shopify: Hepsi</option>
          <option value="yes">✓ Yayında</option>
          <option value="no">⏳ Bekliyor</option>
        </select>
        <button
          type="submit"
          className="md:col-span-5 px-4 py-2 bg-black text-white rounded-lg font-semibold text-sm"
        >
          Filtrele
        </button>
      </form>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Ürün</th>
              <th className="text-left px-4 py-3 font-semibold w-48">Tedarikçi</th>
              <th className="text-left px-4 py-3 font-semibold w-24">Durum</th>
              <th className="text-right px-4 py-3 font-semibold w-28">Fiyat</th>
              <th className="text-right px-4 py-3 font-semibold w-20">Stok</th>
              <th className="text-left px-4 py-3 font-semibold w-32">Shopify</th>
              <th className="text-right px-4 py-3 font-semibold w-56">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-neutral-500">
                  Sonuç yok
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const isPushed = !p.shopifyProductId.startsWith('local_');
              return (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.featuredImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.featuredImageUrl}
                          alt=""
                          className="w-10 h-10 rounded object-cover bg-neutral-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-neutral-100" />
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="font-semibold truncate max-w-md block hover:text-[var(--color-brand-orange)] hover:underline"
                        >
                          {p.title}
                        </Link>
                        {p.sku && (
                          <div className="text-xs text-neutral-500 font-mono">SKU: {p.sku}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{p.vendorName}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_BADGE[p.status] ?? 'bg-neutral-100'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{fmtTL(p.minPriceCents)}</td>
                  <td className="px-4 py-3 text-right">{p.totalInventory ?? 0}</td>
                  <td className="px-4 py-3">
                    {isPushed ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-800">
                        ✓ Yayında
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">
                        Bekliyor
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <AdminProductRowActions productId={p.id} status={p.status} />
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

      <p className="text-xs text-neutral-500 mt-4">
        Tedarikçi seç → <Link href="/admin/products/new" className="underline">Yeni Ürün</Link> ile ürün gir; satırdan
        Düzenle / Yayınla / Taslak / Sil yap. “Yayınla” ürünü aktif yapıp Shopify’a gönderir.
      </p>
    </div>
  );
}
