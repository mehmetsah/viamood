import { and, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { productVariants, products } from '@/db/schema';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Pagination, parsePage } from '@/components/ui/Pagination';

export const revalidate = 300;

const COLLECTIONS: Record<string, {
  title: string;
  desc: string;
  image: string;
  /** Hangi product_type / vendor_slug değerleri bu koleksiyona dahil */
  match: { types?: string[]; vendorSlugs?: string[] };
}> = {
  mutfak: {
    title: 'Mutfak',
    desc: 'El yapımı kesme tahtaları, çelik düzenleyiciler, doğal mutfak gereçleri',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1800&q=80',
    match: { types: ['Mutfak'], vendorSlugs: ['kucuk-mutfak-atolyesi'] },
  },
  baharat: {
    title: 'Baharat',
    desc: 'Konya pazarından doğal baharatlar, otlar, çaylar',
    image: 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=1800&q=80',
    match: { types: ['Baharat'], vendorSlugs: ['konya-baharat-evi'] },
  },
  zeytinyagi: {
    title: 'Zeytinyağı',
    desc: 'Ayvalık ve Edremit\'in soğuk sıkım zeytinyağları',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=1800&q=80',
    match: { types: ['Zeytinyağı', 'Gıda'], vendorSlugs: ['ege-zeytinyagi-atolyesi'] },
  },
  tekstil: {
    title: 'Tekstil',
    desc: 'Anadolu\'nun pamuk havluları, peştemaller, dokuma örtüler',
    image: 'https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=1800&q=80',
    match: { types: ['Tekstil'], vendorSlugs: ['anadolu-tekstil'] },
  },
};

const PAGE_SIZE = 24;

interface PageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { handle } = await params;
  const c = COLLECTIONS[handle];
  if (!c) return { title: 'Koleksiyon' };
  return { title: c.title, description: c.desc };
}

export default async function CollectionPage({ params, searchParams }: PageProps) {
  const { handle } = await params;
  const sp = await searchParams;
  const page = parsePage(sp.page);

  const c = COLLECTIONS[handle];
  if (!c) notFound();

  const matchConds = [];
  if (c.match.types?.length) {
    matchConds.push(or(...c.match.types.map((t) => ilike(products.productType, t)))!);
  }
  if (c.match.vendorSlugs?.length) {
    matchConds.push(or(...c.match.vendorSlugs.map((s) => eq(products.vendorSlug, s)))!);
  }

  const where = and(
    eq(products.status, 'active'),
    isNull(products.deletedAt),
    matchConds.length > 0 ? or(...matchConds) : undefined,
  );

  const cntRes = await db
    .select({ total: count() })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(where);
  const total = cntRes[0]?.total ?? 0;

  const list = await db
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
    .where(where)
    .orderBy(desc(products.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <>
      {/* Hero */}
      <section className="relative h-[40vh] md:h-[55vh] overflow-hidden bg-[var(--color-brand-warm)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={c.image}
          alt={c.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-brand-ink)]/30 via-transparent to-[var(--color-brand-ink)]/50" />
        <div className="absolute inset-0 flex items-center justify-center text-center px-5">
          <div className="text-[var(--color-brand-cream)]">
            <div className="text-xs font-medium tracking-[0.3em] uppercase mb-3 opacity-90">
              Koleksiyon
            </div>
            <h1 className="headline text-5xl md:text-7xl mb-4">{c.title}</h1>
            <p className="max-w-md mx-auto text-sm md:text-base opacity-90">{c.desc}</p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <div className="text-center mb-10 text-sm text-[var(--color-brand-ink)]/60">
          {total} ürün
        </div>
        {list.length === 0 ? (
          <div className="text-center py-32 text-[var(--color-brand-ink)]/60">
            Bu koleksiyonda henüz ürün yok.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {list.map((p) => (
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
            <div className="mt-12">
              <Pagination
                totalCount={total}
                currentPage={page}
                pageSize={PAGE_SIZE}
                searchParams={sp}
              />
            </div>
          </>
        )}
      </section>
    </>
  );
}
