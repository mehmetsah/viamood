import { and, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { inventoryLevels, productVariants, products, vendors } from '@/db/schema';
import { BundleBuilder } from '@/app/(vendor)/bundles/new/BundleBuilder';

export default async function AdminNewBundlePage() {
  // Tüm aktif vendor'ların aktif ürünleri (cross-vendor karma için)
  const variants = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      title: products.title,
      vendorName: products.vendorName,
      sku: productVariants.sku,
      priceCents: productVariants.priceCents,
      costCents: productVariants.costCents,
      weightGrams: productVariants.weightGrams,
      available: inventoryLevels.available,
      imageUrl: products.featuredImageUrl,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(vendors, eq(vendors.id, productVariants.vendorId))
    .leftJoin(
      inventoryLevels,
      and(
        eq(inventoryLevels.variantId, productVariants.id),
        eq(inventoryLevels.vendorId, productVariants.vendorId),
      ),
    )
    .where(and(eq(products.status, 'active'), isNull(products.deletedAt), eq(vendors.status, 'active')))
    .orderBy(products.vendorName, products.title);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/admin/bundles" className="text-sm text-neutral-600 hover:underline">
        ← Set Ürünler
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-2">Yeni Karma Set</h1>
      <p className="text-neutral-600 text-sm mb-8">
        Farklı vendor'ların ürünlerini birleştirip Via Mood adına Set olarak sat. Bu set Shopify'da
        "Via Mood" vendor adıyla yayınlanır.
      </p>

      <BundleBuilder
        variants={variants.map((v) => ({
          variantId: v.variantId,
          title: `${v.title}  ·  ${v.vendorName}`,
          sku: v.sku ?? '',
          imageUrl: v.imageUrl ?? undefined,
          priceCents: Number(v.priceCents),
          costCents: v.costCents != null ? Number(v.costCents) : null,
          weightGrams: v.weightGrams,
          available: v.available ?? 0,
        }))}
        isAdminMixed
      />
    </div>
  );
}
