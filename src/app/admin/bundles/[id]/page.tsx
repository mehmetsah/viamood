import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import {
  bundleComponents,
  inventoryLevels,
  productBundles,
  productVariants,
  products,
  vendors,
} from '@/db/schema';
import { computeBundleMetrics } from '@/lib/server/bundle-service';
import { BundleManageClient } from '@/app/(vendor)/bundles/[id]/BundleManageClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Taslak', cls: 'bg-neutral-200 text-neutral-700' },
  active: { label: 'Yayında', cls: 'bg-green-100 text-green-900' },
  archived: { label: 'Arşiv', cls: 'bg-orange-100 text-orange-900' },
};

function formatTL(cents: number | bigint | null): string {
  if (cents == null) return '—';
  return `${(Number(cents) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

export default async function AdminBundleDetail({ params }: PageProps) {
  const { id } = await params;

  const [bundle] = await db
    .select({
      id: productBundles.id,
      title: productBundles.title,
      sku: productBundles.sku,
      vendorId: productBundles.vendorId,
      vendorName: vendors.name,
      status: productBundles.status,
      bundlePriceCents: productBundles.bundlePriceCents,
      inventoryQuantity: productBundles.inventoryQuantity,
      shopifyProductId: productBundles.shopifyProductId,
      displayVendorName: productBundles.displayVendorName,
    })
    .from(productBundles)
    .leftJoin(vendors, eq(vendors.id, productBundles.vendorId))
    .where(eq(productBundles.id, id))
    .limit(1);

  if (!bundle) notFound();

  const components = await db
    .select({
      id: bundleComponents.id,
      variantId: bundleComponents.variantId,
      quantity: bundleComponents.quantity,
      title: products.title,
      sku: productVariants.sku,
      vendorName: products.vendorName,
      imageUrl: products.featuredImageUrl,
      costSnapshot: bundleComponents.costSnapshotCents,
      priceSnapshot: bundleComponents.priceSnapshotCents,
      shippingSnapshot: bundleComponents.shippingSnapshotCents,
      currentAvailable: inventoryLevels.available,
    })
    .from(bundleComponents)
    .innerJoin(productVariants, eq(productVariants.id, bundleComponents.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(
      inventoryLevels,
      and(
        eq(inventoryLevels.variantId, productVariants.id),
        eq(inventoryLevels.vendorId, productVariants.vendorId),
      ),
    )
    .where(eq(bundleComponents.bundleId, id));

  const metrics = await computeBundleMetrics(id);
  const st = STATUS_LABEL[bundle.status] ?? STATUS_LABEL.draft!;
  const isMixed = !bundle.vendorId;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/admin/bundles" className="text-sm text-neutral-600 hover:underline">
        ← Set Ürünler
      </Link>
      <div className="flex items-start justify-between gap-4 mt-2 mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            {bundle.title}
            <span className={`text-xs font-bold px-2 py-1 rounded ${st.cls}`}>{st.label}</span>
            {isMixed && (
              <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2 py-1 rounded">
                Karma
              </span>
            )}
          </h1>
          <p className="text-neutral-500 text-sm font-mono mt-1">
            {bundle.sku} · {bundle.vendorName ?? bundle.displayVendorName}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">{formatTL(bundle.bundlePriceCents)}</div>
          <div className="text-sm text-neutral-500 mt-1">{bundle.inventoryQuantity} set stoğu</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-neutral-50 border-b font-bold text-sm">
              Set İçeriği ({components.length} ürün)
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="text-left px-4 py-2">Ürün</th>
                  <th className="text-left px-4 py-2">Vendor</th>
                  <th className="text-right px-4 py-2">Adet</th>
                  <th className="text-right px-4 py-2">Set Maliyet</th>
                  <th className="text-right px-4 py-2">Tekil Fiyat</th>
                  <th className="text-right px-4 py-2">Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {components.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.imageUrl} alt="" className="w-10 h-10 object-cover rounded" />
                        ) : (
                          <div className="w-10 h-10 bg-neutral-100 rounded" />
                        )}
                        <div>
                          <div className="font-semibold">{c.title}</div>
                          <div className="text-xs text-neutral-500 font-mono">{c.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600">{c.vendorName}</td>
                    <td className="px-4 py-3 text-right font-mono">{c.quantity}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatTL(Number(c.costSnapshot ?? 0n) * c.quantity)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatTL(Number(c.priceSnapshot) * c.quantity)}
                    </td>
                    <td className="px-4 py-3 text-right">{c.currentAvailable ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <BundleManageClient
            bundleId={bundle.id}
            currentStatus={bundle.status}
            currentInventory={bundle.inventoryQuantity}
            isPushed={!!bundle.shopifyProductId}
            components={components.map((c) => ({
              variantId: c.variantId,
              title: c.title,
              quantity: c.quantity,
              available: c.currentAvailable ?? 0,
            }))}
          />
        </div>

        <aside className="space-y-4">
          {metrics && (
            <section className="bg-[var(--color-brand-ink)] text-white rounded-xl p-6">
              <h3 className="font-bold mb-4 text-sm">📊 Kar Analizi</h3>
              <div className="space-y-2 text-sm">
                <Row label="Toplam maliyet" value={formatTL(metrics.totalCostCents)} />
                <Row label="Tekil satış toplamı" value={formatTL(metrics.normalPriceCents)} />
                <Row label="Set fiyatı" value={formatTL(metrics.bundlePriceCents)} bold />
                <div className="border-t border-white/20 my-2" />
                <Row label="Tekil kargo" value={formatTL(metrics.individualShippingCents)} />
                <Row label="Set kargo" value={formatTL(metrics.bundleShippingCents)} />
                <Row label="Kargo tasarrufu" value={formatTL(metrics.shippingSavingsCents)} positive={metrics.shippingSavingsCents > 0} />
                <div className="border-t border-white/20 my-2" />
                <Row label="Tekil kar" value={formatTL(metrics.profitIfSoldIndividuallyCents)} />
                <Row label="Set kar" value={formatTL(metrics.profitIfSoldAsBundleCents)} bold
                  positive={metrics.profitIfSoldAsBundleCents > 0}
                  negative={metrics.profitIfSoldAsBundleCents < 0} />
                <Row label="Fark" value={formatTL(metrics.profitDifferenceCents)}
                  positive={metrics.profitDifferenceCents > 0}
                  negative={metrics.profitDifferenceCents < 0} />
              </div>
            </section>
          )}

          {metrics && metrics.componentProfitShare.length > 0 && (
            <section className="bg-white rounded-xl border p-5">
              <h3 className="font-bold mb-3 text-sm">Komponent Kar Payı</h3>
              <div className="space-y-2 text-xs">
                {metrics.componentProfitShare.map((c) => (
                  <div key={c.variantId} className="flex justify-between gap-3">
                    <span className="truncate flex-1">{c.title} × {c.quantity}</span>
                    <span className="text-neutral-500 shrink-0">%{(c.costShare * 100).toFixed(0)}</span>
                    <span className="font-mono shrink-0">{formatTL(c.profitShareCents)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, bold, positive, negative }: {
  label: string; value: string; bold?: boolean; positive?: boolean; negative?: boolean;
}) {
  const cls = positive ? 'text-green-300' : negative ? 'text-red-300' : '';
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-white/70 text-xs">{label}</span>
      <span className={`font-mono ${bold ? 'font-bold text-base' : ''} ${cls}`}>{value}</span>
    </div>
  );
}
