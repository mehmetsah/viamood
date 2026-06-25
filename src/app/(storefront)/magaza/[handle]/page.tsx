import { and, eq, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { products, productVariants } from '@/db/schema';
import { AddToCart } from './AddToCart';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ handle: string }>;
}

export default async function ProductPage({ params }: PageProps) {
  const { handle } = await params;

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.shopifyHandle, handle), eq(products.status, 'active'), isNull(products.deletedAt)))
    .limit(1);
  if (!product) notFound();

  const variants = await db
    .select({
      vid: productVariants.shopifyVariantId,
      title: productVariants.title,
      o1: productVariants.option1,
      o2: productVariants.option2,
      o3: productVariants.option3,
      priceCents: productVariants.priceCents,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, product.id));

  const options =
    (product.metadata as { options?: { name: string; values: string[] }[] } | null)?.options ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-10">
      <div className="aspect-square bg-white rounded-2xl border overflow-hidden">
        {product.featuredImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.featuredImageUrl} alt={product.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300 text-6xl">🛍️</div>
        )}
      </div>

      <div>
        <h1 className="text-3xl font-bold">{product.title}</h1>
        {product.vendorName && (
          <p className="text-sm text-neutral-500 mt-1">{product.vendorName}</p>
        )}

        <AddToCart
          variants={variants.map((v) => ({
            vid: v.vid,
            title: v.title,
            o1: v.o1,
            o2: v.o2,
            o3: v.o3,
            priceCents: Number(v.priceCents),
          }))}
          options={options}
        />

        {product.description && (
          <div className="mt-8 pt-6 border-t prose prose-sm max-w-none text-neutral-700"
            dangerouslySetInnerHTML={{ __html: product.description }} />
        )}
      </div>
    </div>
  );
}
