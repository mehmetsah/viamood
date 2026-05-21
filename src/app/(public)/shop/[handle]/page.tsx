import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { productVariants, products } from '@/db/schema';
import { ProductCard } from '@/components/storefront/ProductCard';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ handle: string }>;
}

function formatTL(cents: bigint | number | null | undefined): string {
  if (cents == null) return '—';
  return (Number(cents) / 100).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ₺';
}

export async function generateMetadata({ params }: PageProps) {
  const { handle } = await params;
  const [p] = await db
    .select({ title: products.title, description: products.description, image: products.featuredImageUrl })
    .from(products)
    .where(eq(products.shopifyHandle, handle))
    .limit(1);
  if (!p) return { title: 'Ürün bulunamadı' };
  const desc = p.description?.replace(/<[^>]+>/g, '').slice(0, 160);
  return {
    title: p.title,
    description: desc,
    openGraph: {
      title: p.title,
      description: desc,
      images: p.image ? [{ url: p.image }] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { handle } = await params;

  const [row] = await db
    .select({
      id: products.id,
      title: products.title,
      description: products.description,
      productType: products.productType,
      tags: products.tags,
      vendorId: products.vendorId,
      vendorName: products.vendorName,
      imageUrl: products.featuredImageUrl,
      shopifyProductId: products.shopifyProductId,
      totalInventory: products.totalInventory,
      variantId: productVariants.id,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
      priceCents: productVariants.priceCents,
      compareAtPriceCents: productVariants.compareAtPriceCents,
      weightGrams: productVariants.weightGrams,
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(
      and(
        eq(products.shopifyHandle, handle),
        eq(products.status, 'active'),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);

  if (!row) notFound();

  // Aynı vendor'dan başka ürünler
  const related = await db
    .select({
      id: products.id,
      handle: products.shopifyHandle,
      title: products.title,
      vendorName: products.vendorName,
      imageUrl: products.featuredImageUrl,
      priceCents: products.minPriceCents,
      compareAtPriceCents: productVariants.compareAtPriceCents,
      totalInventory: products.totalInventory,
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(
      and(
        eq(products.vendorId, row.vendorId),
        eq(products.status, 'active'),
        isNull(products.deletedAt),
        ne(products.id, row.id),
      ),
    )
    .orderBy(sql`RANDOM()`)
    .limit(4);

  const inStock = (row.totalInventory ?? 0) > 0;
  const hasDiscount =
    row.compareAtPriceCents != null &&
    Number(row.compareAtPriceCents) > Number(row.priceCents);

  // Shopify checkout link — gerçek Shopify product page
  const shopifyCheckoutUrl = `https://via-mood.myshopify.com/products/${handle}`;

  return (
    <>
      {/* Breadcrumb */}
      <div className="border-b border-[var(--color-brand-ink)]/10">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-3 text-xs font-medium tracking-wider uppercase text-[var(--color-brand-ink)]/60">
          <Link href="/" className="link-underline">Ana Sayfa</Link>
          <span className="mx-2">/</span>
          <Link href="/shop" className="link-underline">Mağaza</Link>
          {row.productType && (
            <>
              <span className="mx-2">/</span>
              <span>{row.productType}</span>
            </>
          )}
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16">
          {/* Image */}
          <div className="aspect-square bg-[var(--color-brand-warm)] overflow-hidden">
            {row.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={row.imageUrl}
                alt={row.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[var(--color-brand-stone)] text-7xl">
                ⌂
              </div>
            )}
          </div>

          {/* Info */}
          <div className="md:py-4">
            {row.vendorName && (
              <div className="text-xs font-medium tracking-[0.25em] uppercase text-[var(--color-brand-clay)] mb-3">
                {row.vendorName}
              </div>
            )}

            <h1 className="headline text-4xl md:text-5xl mb-6">{row.title}</h1>

            <div className="flex items-baseline gap-3 mb-8">
              <span className="text-3xl font-medium text-[var(--color-brand-ink)]">
                {formatTL(row.priceCents)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-[var(--color-brand-ink)]/40 line-through">
                    {formatTL(row.compareAtPriceCents)}
                  </span>
                  <span className="bg-[var(--color-brand-orange)] text-white text-[10px] font-bold tracking-widest uppercase px-2 py-1">
                    İndirim
                  </span>
                </>
              )}
            </div>

            <div className="hairline mb-6" />

            {row.description && (
              <div
                className="text-[var(--color-brand-ink)]/80 leading-relaxed mb-8 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: row.description }}
              />
            )}

            {/* Stock indicator */}
            <div className="mb-6 flex items-center gap-2 text-sm">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  inStock ? 'bg-green-600' : 'bg-red-500'
                }`}
              />
              <span className="text-[var(--color-brand-ink)]/70">
                {inStock
                  ? row.totalInventory! > 5
                    ? 'Stokta var'
                    : `Son ${row.totalInventory} adet`
                  : 'Tükendi'}
              </span>
            </div>

            {/* CTA */}
            <div className="space-y-3">
              <a
                href={shopifyCheckoutUrl}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!inStock}
                className={`block w-full text-center px-8 py-5 text-xs font-bold tracking-[0.25em] uppercase transition ${
                  inStock
                    ? 'bg-[var(--color-brand-ink)] text-[var(--color-brand-cream)] hover:bg-[var(--color-brand-orange)]'
                    : 'bg-[var(--color-brand-stone)] text-[var(--color-brand-ink)]/40 pointer-events-none'
                }`}
              >
                {inStock ? 'Sepete Ekle' : 'Tükendi'}
              </a>
              <p className="text-xs text-[var(--color-brand-ink)]/50 text-center">
                Ödeme via-mood.myshopify.com'da güvenle tamamlanır
              </p>
            </div>

            {/* Detaylar */}
            <details className="mt-10 group">
              <summary className="cursor-pointer flex items-center justify-between border-t border-[var(--color-brand-ink)]/15 pt-5 text-sm font-semibold tracking-wider uppercase">
                <span>Ürün Detayları</span>
                <span className="group-open:rotate-180 transition">↓</span>
              </summary>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 mt-5 text-sm">
                {row.sku && (
                  <>
                    <dt className="text-[var(--color-brand-ink)]/60">SKU</dt>
                    <dd className="font-mono">{row.sku}</dd>
                  </>
                )}
                {row.barcode && (
                  <>
                    <dt className="text-[var(--color-brand-ink)]/60">Barkod</dt>
                    <dd className="font-mono text-xs">{row.barcode}</dd>
                  </>
                )}
                {row.weightGrams && (
                  <>
                    <dt className="text-[var(--color-brand-ink)]/60">Ağırlık</dt>
                    <dd>{(row.weightGrams / 1000).toFixed(2)} kg</dd>
                  </>
                )}
                {row.productType && (
                  <>
                    <dt className="text-[var(--color-brand-ink)]/60">Kategori</dt>
                    <dd>{row.productType}</dd>
                  </>
                )}
              </dl>
            </details>

            {/* Tags */}
            {row.tags && Array.isArray(row.tags) && row.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {(row.tags as string[]).map((t) => (
                  <span
                    key={t}
                    className="text-[11px] tracking-wider uppercase px-3 py-1 border border-[var(--color-brand-ink)]/20 text-[var(--color-brand-ink)]/60"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Vendor showcase strip */}
      {row.vendorName && (
        <section className="bg-[var(--color-brand-warm)] py-12 md:py-16 text-center">
          <div className="max-w-2xl mx-auto px-5">
            <div className="text-xs font-medium tracking-[0.25em] uppercase text-[var(--color-brand-clay)] mb-3">
              Üretici
            </div>
            <h2 className="headline text-3xl md:text-4xl mb-4">{row.vendorName}</h2>
            <p className="text-[var(--color-brand-ink)]/70 mb-5">
              Bu ürün küçük bir atölyenin elinden çıkıyor. Her bir parça özenle hazırlanır.
            </p>
          </div>
        </section>
      )}

      {/* Related products */}
      {related.length > 0 && (
        <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-20">
          <h2 className="headline text-3xl md:text-4xl mb-10 text-center">Aynı Üreticiden</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                handle={p.handle}
                title={p.title}
                imageUrl={p.imageUrl}
                vendorName={p.vendorName}
                priceCents={p.priceCents}
                compareAtPriceCents={p.compareAtPriceCents}
                isSoldOut={(p.totalInventory ?? 0) <= 0}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
