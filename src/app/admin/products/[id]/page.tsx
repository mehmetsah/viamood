import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { products, productVariants } from '@/db/schema';
import { AdminProductEditClient } from './AdminProductEditClient';

function centsToTL(c: bigint | number | null | undefined): string {
  if (c == null) return '';
  return (Number(c) / 100).toString();
}

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) notFound();

  const [variant] = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, id))
    .limit(1);

  const defaults = {
    title: product.title,
    description: product.description ?? '',
    productType: product.productType ?? '',
    tags: (product.tags ?? []).join(', '),
    status: product.status,
    sku: variant?.sku ?? '',
    barcode: variant?.barcode ?? '',
    price: centsToTL(variant?.priceCents),
    compareAtPrice: centsToTL(variant?.compareAtPriceCents),
    cost: centsToTL(variant?.costCents),
    weightGrams: variant?.weightGrams != null ? String(variant.weightGrams) : '',
    featuredImageUrl: product.featuredImageUrl ?? '',
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/admin/products" className="text-sm text-neutral-600 hover:underline">
        ← Tüm Ürünler
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-1">{product.title}</h1>
      <p className="text-sm text-neutral-600 mb-8">
        Tedarikçi: <strong className="text-neutral-900">{product.vendorName}</strong>
      </p>
      <AdminProductEditClient
        productId={product.id}
        defaults={defaults}
        status={product.status}
        shopifyProductId={product.shopifyProductId}
        shopifyHandle={product.shopifyHandle}
      />
    </div>
  );
}
