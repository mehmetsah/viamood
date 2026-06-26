import { and, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { products, productVariants } from '@/db/schema';
import { getStorefrontProducts } from '@/lib/storefront/products';
import { GridCard } from '../../_home/cards';
import { AddToCart } from './AddToCart';

export const dynamic = 'force-dynamic';

const ASSURE = [
  { label: 'Ücretsiz Kargo', svg: '<rect x="1" y="6" width="13" height="11" rx="1"/><path d="M14 9h4l3 3v5h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>' },
  { label: 'Kapıda Ödeme', svg: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>' },
  { label: 'Güvenli Ödeme', svg: '<path d="M12 2l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5z"/><path d="M9 12l2 2 4-4"/>' },
  { label: 'Kolay İade', svg: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>' },
];

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
      sku: productVariants.sku,
      priceCents: productVariants.priceCents,
      compareAtCents: productVariants.compareAtPriceCents,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, product.id));

  const meta = product.metadata as { options?: { name: string; values: string[] }[]; images?: string[] } | null;
  const options = meta?.options ?? [];
  const gallery = [product.featuredImageUrl, ...(meta?.images ?? [])].filter((x): x is string => !!x);
  const mainImg = gallery[0] ?? null;

  const related = product.productType
    ? (await getStorefrontProducts({ cat: product.productType, limit: 5 })).filter((p) => p.handle !== handle).slice(0, 4)
    : [];

  return (
    <div className="emp">
      <section className="emp-pdp">
        <div className="emp-wrap">
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            <Link href="/" style={{ color: 'var(--muted)' }}>Ana Sayfa</Link> ·{' '}
            <Link href="/magaza" style={{ color: 'var(--muted)' }}>Ürünler</Link> · {product.title}
          </p>

          <div className="emp-pdp__grid">
            {/* Galeri */}
            <div className="emp-pdp__gallery">
              <div className="emp-pdp__main">
                {mainImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mainImg} alt={product.title} />
                ) : (
                  <div className="emp-ph" style={{ fontSize: 64 }}>🛍️</div>
                )}
              </div>
              {gallery.length > 1 && (
                <div className="emp-pdp__thumbs">
                  {gallery.slice(0, 6).map((g, i) => (
                    <div key={i} className="emp-pdp__thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g} alt="" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Detaylar */}
            <div>
              {product.vendorName ? <p className="emp-pdp__vendor">{product.vendorName}</p> : null}
              <h1 className="emp-pdp__title">{product.title}</h1>

              <AddToCart
                variants={variants.map((v) => ({
                  vid: v.vid,
                  title: v.title,
                  o1: v.o1,
                  o2: v.o2,
                  o3: v.o3,
                  sku: v.sku,
                  priceCents: Number(v.priceCents),
                  compareAtCents: v.compareAtCents != null ? Number(v.compareAtCents) : null,
                }))}
                options={options}
                sku={variants[0]?.sku ?? null}
              />

              <div className="emp-assure">
                {ASSURE.map((a) => (
                  <div key={a.label} className="emp-assure__i">
                    {/* eslint-disable-next-line react/no-danger */}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" dangerouslySetInnerHTML={{ __html: a.svg }} />
                    <span>{a.label}</span>
                  </div>
                ))}
              </div>

              {product.description ? (
                <div className="emp-pdp__desc">
                  <h2>Ürün Açıklaması</h2>
                  {/* eslint-disable-next-line react/no-danger */}
                  <div dangerouslySetInnerHTML={{ __html: product.description }} />
                </div>
              ) : null}
            </div>
          </div>

          {related.length > 0 && (
            <div style={{ marginTop: 'clamp(48px,6vw,80px)' }}>
              <div className="emp-secthead">
                <div className="emp-secthead__row">
                  <h2 className="emp-secthead__title">Benzer ürünler</h2>
                  <Link href="/magaza" className="emp-secthead__link">Tümünü gör →</Link>
                </div>
              </div>
              <div className="emp-pgrid">
                {related.map((p) => <GridCard key={p.handle} p={p} />)}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
