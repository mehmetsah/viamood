import { and, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { inventoryLevels, productVariants, products, vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';
import { BundleBuilder } from './BundleBuilder';

export default async function NewBundlePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');

  const [membership] = await db
    .select({ vendorId: vendors.id, status: vendors.status, name: vendors.name })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) redirect('/onboarding');
  if (membership.status !== 'active') {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-sm text-yellow-900">
          Set yaratmak için tedarikçi durumun aktif olmalı.
        </div>
      </div>
    );
  }

  // Bu vendor'ın tüm aktif ürünleri (set yapılabilecek)
  const variants = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      title: products.title,
      sku: productVariants.sku,
      priceCents: productVariants.priceCents,
      costCents: productVariants.costCents,
      weightGrams: productVariants.weightGrams,
      available: inventoryLevels.available,
      imageUrl: products.featuredImageUrl,
      status: products.status,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(
      inventoryLevels,
      and(
        eq(inventoryLevels.variantId, productVariants.id),
        eq(inventoryLevels.vendorId, productVariants.vendorId),
      ),
    )
    .where(
      and(
        eq(productVariants.vendorId, membership.vendorId),
        eq(products.status, 'active'),
        isNull(products.deletedAt),
      ),
    )
    .orderBy(products.title);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/bundles" className="text-sm text-neutral-600 hover:underline">
        ← Set Ürünler
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-2">Yeni Set Ürün</h1>
      <p className="text-neutral-600 text-sm mb-8">
        Kendi ürünlerinden birden fazla seçip Set olarak özel fiyatla sat. Set Shopify'a ayrı bir
        ürün olarak yayınlanır.
      </p>

      <BundleBuilder
        variants={variants.map((v) => ({
          variantId: v.variantId,
          title: v.title,
          sku: v.sku ?? '',
          imageUrl: v.imageUrl ?? undefined,
          priceCents: Number(v.priceCents),
          costCents: v.costCents != null ? Number(v.costCents) : null,
          weightGrams: v.weightGrams,
          available: v.available ?? 0,
        }))}
        isAdminMixed={false}
      />
    </div>
  );
}
