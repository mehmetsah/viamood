import { and, eq, isNull, ne } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { products, productVariants } from '@/db/schema';
import { AddToCart } from './AddToCart';

export const dynamic = 'force-dynamic';

function priceLabel(min: bigint | null, max: bigint | null): string {
  const lo = Number(min ?? 0) / 100;
  const hi = Number(max ?? 0) / 100;
  const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
  return lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
}

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

  // Benzer ürünler (aynı kategori, kendisi hariç)
  const related = product.productType
    ? await db
        .select({
          handle: products.shopifyHandle,
          title: products.title,
          image: products.featuredImageUrl,
          min: products.minPriceCents,
          max: products.maxPriceCents,
        })
        .from(products)
        .where(
          and(
            eq(products.productType, product.productType),
            eq(products.status, 'active'),
            isNull(products.deletedAt),
            ne(products.id, product.id),
          ),
        )
        .limit(4)
    : [];

  return (
   <div className="max-w-5xl mx-auto px-4 py-10">
    <div className="grid md:grid-cols-2 gap-10">
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

    {related.length > 0 && (
      <section className="mt-16 border-t pt-10">
        <h2 className="text-xl font-bold mb-6">Benzer ürünler</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {related.map((p) => (
            <Link key={p.handle} href={`/magaza/${p.handle}`} className="group block">
              <div className="aspect-square bg-white rounded-xl border overflow-hidden mb-2">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-300 text-4xl">🛍️</div>
                )}
              </div>
              <p className="text-sm font-medium line-clamp-2">{p.title}</p>
              <p className="text-sm text-neutral-500">{priceLabel(p.min, p.max)}</p>
            </Link>
          ))}
        </div>
      </section>
    )}
   </div>
  );
}
