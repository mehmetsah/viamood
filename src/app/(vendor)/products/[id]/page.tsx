import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/db/client';
import { products, productVariants, vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';
import { ProductEditClient } from './ProductEditClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');

  const [membership] = await db
    .select({ vendorId: vendors.id })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) redirect('/onboarding');

  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.vendorId, membership.vendorId)))
    .limit(1);

  if (!row) notFound();

  const [variant] = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, row.id))
    .limit(1);

  const defaults = {
    title: row.title,
    description: row.description ?? '',
    productType: row.productType ?? '',
    tags: (row.tags ?? []).join(', '),
    status: row.status,
    sku: variant?.sku ?? '',
    barcode: variant?.barcode ?? '',
    price: variant ? (Number(variant.priceCents) / 100).toFixed(2) : '0.00',
    compareAtPrice: variant?.compareAtPriceCents ? (Number(variant.compareAtPriceCents) / 100).toFixed(2) : '',
    cost: variant?.costCents ? (Number(variant.costCents) / 100).toFixed(2) : '',
    weightGrams: variant?.weightGrams != null ? String(variant.weightGrams) : '',
    featuredImageUrl: row.featuredImageUrl ?? '',
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/products" className="text-sm text-neutral-600 hover:underline">
        ← Ürünler
      </Link>
      <div className="flex items-center justify-between mt-2 mb-8">
        <h1 className="text-3xl font-bold">Ürünü Düzenle</h1>
        <span className="text-xs text-neutral-500 font-mono">ID: {row.id.slice(0, 8)}</span>
      </div>
      <ProductEditClient productId={row.id} defaults={defaults} />
    </div>
  );
}
