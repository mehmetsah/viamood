import { count, desc, eq, isNull, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Suspense } from 'react';
import CustodyStatusPanel from '@/components/dashboard/CustodyStatusPanel';
import StatementSummaryPanel from '@/components/dashboard/StatementSummaryPanel';
import { db } from '@/db/client';
import { inventoryLevels, productVariants, products, vendors } from '@/db/schema';

export default async function AdminDashboardPage() {
  const [pending] = await db
    .select({ count: count() })
    .from(vendors)
    .where(eq(vendors.status, 'pending'));
  const [active] = await db
    .select({ count: count() })
    .from(vendors)
    .where(eq(vendors.status, 'active'));
  const [suspended] = await db
    .select({ count: count() })
    .from(vendors)
    .where(eq(vendors.status, 'suspended'));

  const stats = [
    {
      label: 'Bekleyen başvuru',
      value: pending?.count ?? 0,
      color: 'bg-yellow-100 text-yellow-900',
      href: '/admin/vendors?status=pending',
    },
    {
      label: 'Aktif tedarikçi',
      value: active?.count ?? 0,
      color: 'bg-green-100 text-green-900',
      href: '/admin/vendors?status=active',
    },
    {
      label: 'Askıdaki',
      value: suspended?.count ?? 0,
      color: 'bg-orange-100 text-orange-900',
      href: '/admin/vendors?status=suspended',
    },
  ];

  // Kategori bazlı SKU + stok toplamı
  const categoryStats = await db
    .select({
      productType: products.productType,
      skuCount: sql<number>`COUNT(DISTINCT ${products.id})::int`,
      activeSkuCount: sql<number>`COUNT(DISTINCT ${products.id}) FILTER (WHERE ${products.status} = 'active')::int`,
      totalStock: sql<number>`COALESCE(SUM(${inventoryLevels.available}), 0)::int`,
      vendorCount: sql<number>`COUNT(DISTINCT ${products.vendorId})::int`,
    })
    .from(products)
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .leftJoin(inventoryLevels, sql`${inventoryLevels.variantId} = ${productVariants.id}`)
    .where(isNull(products.deletedAt))
    .groupBy(products.productType)
    .orderBy(desc(sql<number>`COUNT(DISTINCT ${products.id})`));

  // Vendor bazlı SKU + stok
  const vendorStats = await db
    .select({
      vendorId: products.vendorId,
      vendorName: products.vendorName,
      skuCount: sql<number>`COUNT(DISTINCT ${products.id})::int`,
      activeSkuCount: sql<number>`COUNT(DISTINCT ${products.id}) FILTER (WHERE ${products.status} = 'active')::int`,
      totalStock: sql<number>`COALESCE(SUM(${inventoryLevels.available}), 0)::int`,
    })
    .from(products)
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .leftJoin(inventoryLevels, sql`${inventoryLevels.variantId} = ${productVariants.id}`)
    .where(isNull(products.deletedAt))
    .groupBy(products.vendorId, products.vendorName)
    .orderBy(desc(sql<number>`COUNT(DISTINCT ${products.id})`));

  const grand = {
    sku: categoryStats.reduce((s, c) => s + (c.skuCount ?? 0), 0),
    activeSku: categoryStats.reduce((s, c) => s + (c.activeSkuCount ?? 0), 0),
    stock: categoryStats.reduce((s, c) => s + (c.totalStock ?? 0), 0),
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
      <p className="text-neutral-600 mb-8">Pazaryeri operatör görünümü</p>

      {/* Zimmet durumu — KargoLab'den canlı. Suspense: yavaş yanıt sayfanın kalanını bekletmesin. */}
      <Suspense
        fallback={
          <section className="mb-8">
            <div className="h-28 rounded-xl bg-neutral-100 animate-pulse" />
          </section>
        }
      >
        <CustodyStatusPanel />
      </Suspense>

      {/* Cari ozeti — KargoLab'den canli. Detay icin tek tikla gecis (C8). */}
      <Suspense
        fallback={
          <section className="mb-8">
            <div className="h-28 rounded-xl bg-neutral-100 animate-pulse" />
          </section>
        }
      >
        <StatementSummaryPanel />
      </Suspense>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`block rounded-xl p-6 ${s.color} hover:opacity-90 transition`}
          >
            <div className="text-sm font-medium">{s.label}</div>
            <div className="text-4xl font-bold mt-2">{s.value}</div>
          </Link>
        ))}
      </div>

      {/* Grand toplam */}
      <div className="bg-[var(--color-brand-ink)] text-white rounded-xl p-6 mb-6 grid grid-cols-3 gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest opacity-70">Toplam SKU</div>
          <div className="text-3xl font-bold mt-1">{grand.sku}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest opacity-70">Yayında SKU</div>
          <div className="text-3xl font-bold mt-1 text-green-300">{grand.activeSku}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest opacity-70">Toplam Stok (adet)</div>
          <div className="text-3xl font-bold mt-1">{grand.stock.toLocaleString('tr-TR')}</div>
        </div>
      </div>

      <section className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">📊 Kategori Bazlı Stok</h2>
          <Link href="/admin/products" className="text-sm text-[var(--color-brand-orange)] hover:underline">
            Ürünleri gör →
          </Link>
        </div>
        {categoryStats.length === 0 ? (
          <p className="text-sm text-neutral-500">Henüz ürün yok</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="py-2 font-semibold">Kategori</th>
                <th className="py-2 font-semibold text-right">Tedarikçi</th>
                <th className="py-2 font-semibold text-right">Toplam SKU</th>
                <th className="py-2 font-semibold text-right">Yayında</th>
                <th className="py-2 font-semibold text-right">Stok (adet)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {categoryStats.map((c, i) => (
                <tr key={c.productType ?? `none-${i}`} className="hover:bg-neutral-50">
                  <td className="py-3 font-semibold">
                    {c.productType ?? (
                      <span className="text-neutral-400 italic">(belirtilmemiş)</span>
                    )}
                  </td>
                  <td className="py-3 text-right text-neutral-600">{c.vendorCount}</td>
                  <td className="py-3 text-right font-mono">{c.skuCount}</td>
                  <td className="py-3 text-right font-mono text-green-700">{c.activeSkuCount}</td>
                  <td className="py-3 text-right font-mono">
                    {c.totalStock?.toLocaleString('tr-TR') ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">🏢 Tedarikçi Bazlı Stok</h2>
          <Link href="/admin/vendors" className="text-sm text-[var(--color-brand-orange)] hover:underline">
            Tedarikçilere git →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr className="text-left text-xs uppercase tracking-wider text-neutral-500">
              <th className="py-2 font-semibold">Tedarikçi</th>
              <th className="py-2 font-semibold text-right">Toplam SKU</th>
              <th className="py-2 font-semibold text-right">Yayında</th>
              <th className="py-2 font-semibold text-right">Stok (adet)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {vendorStats.map((v) => (
              <tr key={v.vendorId} className="hover:bg-neutral-50">
                <td className="py-3 font-semibold">{v.vendorName}</td>
                <td className="py-3 text-right font-mono">{v.skuCount}</td>
                <td className="py-3 text-right font-mono text-green-700">{v.activeSkuCount}</td>
                <td className="py-3 text-right font-mono">
                  {v.totalStock?.toLocaleString('tr-TR') ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
