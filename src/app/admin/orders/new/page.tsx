import { and, asc, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { productVariants, products, vendors } from '@/db/schema';
import { TestOrderForm } from './TestOrderForm';

export default async function NewTestOrderPage() {
  // Aktif vendor'ların satılabilir variant'larını çek
  const variants = await db
    .select({
      variantId: productVariants.id,
      productTitle: products.title,
      variantTitle: productVariants.title,
      sku: productVariants.sku,
      priceCents: productVariants.priceCents,
      vendorId: vendors.id,
      vendorName: vendors.name,
      vendorStatus: vendors.status,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(vendors, eq(vendors.id, productVariants.vendorId))
    .where(and(isNull(products.deletedAt), eq(products.status, 'active')))
    .orderBy(asc(vendors.name), asc(products.title))
    .limit(500);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/admin/orders" className="text-sm text-neutral-600 hover:underline">
        ← Siparişler
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-2">Test Sipariş Yarat</h1>
      <p className="text-neutral-600 text-sm mb-8">
        Routing engine'i ve fulfillment akışını test etmek için. Phase 2.3'te bu Shopify webhook'tan
        otomatik gelecek.
      </p>
      {variants.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-sm text-yellow-900">
          Henüz aktif ürün yok. Önce bir vendor onaylayıp ürün eklenmesi lazım.
        </div>
      ) : (
        <TestOrderForm
          variants={variants.map((v) => ({
            variantId: v.variantId,
            productTitle: v.productTitle,
            variantTitle: v.variantTitle,
            sku: v.sku,
            priceCents: Number(v.priceCents),
            vendorId: v.vendorId,
            vendorName: v.vendorName,
          }))}
        />
      )}
    </div>
  );
}
