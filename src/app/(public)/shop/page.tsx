import { and, asc, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { productVariants, products, vendors } from '@/db/schema';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Pagination, parsePage } from '@/components/ui/Pagination';

export const revalidate = 300;

const PAGE_SIZE = 24;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    vendor?: string;
    sort?: 'new' | 'price-asc' | 'price-desc' | 'a-z';
    page?: string;
  }>;
}

export const metadata = {
  title: 'Tüm Ürünler',
  description: 'Via Mood pazaryerinde 80+ özenle seçilmiş el yapımı ürün',
};

export default async function ShopPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { q, vendor, sort = 'new' } = sp;
  const page = parsePage(sp.page);

  const conds = [eq(products.status, 'active'), isNull(products.deletedAt)];
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    conds.push(or(ilike(products.title, like), ilike(productVariants.sku, like))!);
  }
  if (vendor && vendor !== 'all') {
    conds.push(eq(products.vendorId, vendor));
  }

  const where = and(...conds);

  const orderBy =
    sort === 'price-asc' ? asc(products.minPriceCents)
    : sort === 'price-desc' ? desc(products.minPriceCents)
    : sort === 'a-z' ? asc(products.title)
    : desc(products.createdAt);

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
    .orderBy(orderBy)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const vendorList = await db
    .select({ id: vendors.id, name: vendors.name })
    .from(vendors)
    .where(eq(vendors.status, 'active'))
    .orderBy(vendors.name);

  return (
    <>
      {/* Hero */}
      <section className="bg-[var(--color-brand-warm)] py-16 md:py-20 text-center">
        <div className="max-w-3xl mx-auto px-5">
          <div className="text-xs font-medium tracking-[0.25em] uppercase text-[var(--color-brand-clay)] mb-3">
            Mağaza
          </div>
          <h1 className="headline text-5xl md:text-6xl mb-4">Tüm Ürünler</h1>
          <p className="text-[var(--color-brand-ink)]/70">
            {total} özenle seçilmiş ürün, küçük üreticilerden
          </p>
        </div>
      </section>

      {/* Filter bar */}
      <div className="border-b border-[var(--color-brand-ink)]/10 sticky top-0 bg-[var(--color-brand-cream)]/95 backdrop-blur z-10">
        <form className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex flex-wrap items-center gap-3 text-sm">
          <input
            type="text"
            name="q"
            placeholder="Ara…"
            defaultValue={q ?? ''}
            className="flex-1 min-w-[200px] bg-transparent border-b border-[var(--color-brand-ink)]/30 py-2 focus:outline-none focus:border-[var(--color-brand-ink)] placeholder:text-[var(--color-brand-ink)]/40"
          />
          <select
            name="vendor"
            defaultValue={vendor ?? 'all'}
            className="bg-transparent border-b border-[var(--color-brand-ink)]/30 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">Tüm Üreticiler</option>
            {vendorList.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <select
            name="sort"
            defaultValue={sort}
            className="bg-transparent border-b border-[var(--color-brand-ink)]/30 py-2 focus:outline-none cursor-pointer"
          >
            <option value="new">En Yeni</option>
            <option value="price-asc">Fiyat ↑</option>
            <option value="price-desc">Fiyat ↓</option>
            <option value="a-z">İsim A-Z</option>
          </select>
          <button
            type="submit"
            className="px-5 py-2 bg-[var(--color-brand-ink)] text-[var(--color-brand-cream)] text-xs font-bold tracking-widest uppercase hover:bg-[var(--color-brand-orange)] transition"
          >
            Uygula
          </button>
        </form>
      </div>

      {/* Grid */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-12 md:py-16">
        {list.length === 0 ? (
          <div className="text-center py-32 text-[var(--color-brand-ink)]/60">
            Sonuç bulunamadı.{' '}
            <Link href="/shop" className="link-underline font-semibold">
              Tüm ürünleri gör
            </Link>
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
