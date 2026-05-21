import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { products, productVariants } from '@/db/schema';
import { ProductCard } from '@/components/storefront/ProductCard';

export const revalidate = 300; // 5dk ISR

const COLLECTIONS = [
  {
    handle: 'mutfak',
    title: 'Mutfak',
    desc: 'Bambu kesme tahtalarından çelik düzenleyicilere',
    img: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&q=80',
  },
  {
    handle: 'baharat',
    title: 'Baharat',
    desc: 'Konya pazarından doğal baharatlar',
    img: 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=900&q=80',
  },
  {
    handle: 'zeytinyagi',
    title: 'Zeytinyağı',
    desc: 'Ege\'nin soğuk sıkım hikayesi',
    img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=900&q=80',
  },
  {
    handle: 'tekstil',
    title: 'Tekstil',
    desc: 'Anadolu\'nun el dokuması',
    img: 'https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=900&q=80',
  },
];

export default async function HomePage() {
  const featured = await db
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
    .where(and(eq(products.status, 'active'), isNull(products.deletedAt)))
    .orderBy(sql`RANDOM()`)
    .limit(8);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="grid md:grid-cols-2 min-h-[70vh]">
          <div className="bg-[var(--color-brand-cream)] flex items-center justify-center px-8 md:px-16 py-16 order-2 md:order-1">
            <div className="max-w-md">
              <div className="text-xs font-medium tracking-[0.25em] uppercase text-[var(--color-brand-clay)] mb-5">
                Yeni Sezon · Bahar 2026
              </div>
              <h1 className="headline text-5xl md:text-6xl lg:text-7xl mb-6">
                Doğanın Renkleriyle Modern Yaşam
              </h1>
              <p className="text-base md:text-lg text-[var(--color-brand-ink)]/70 leading-relaxed mb-8 font-light">
                Türkiye'nin küçük üreticilerinin el yapımı, doğal ve hikayesi olan
                ürünleri. Anadolu'nun bereketi mutfağınıza, evinize.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/shop"
                  className="inline-flex items-center px-8 py-4 bg-[var(--color-brand-ink)] text-[var(--color-brand-cream)] text-xs font-bold tracking-[0.2em] uppercase hover:bg-[var(--color-brand-orange)] transition"
                >
                  Ürünleri Keşfet
                </Link>
                <Link
                  href="/hakkimizda"
                  className="inline-flex items-center px-8 py-4 border-2 border-[var(--color-brand-ink)] text-[var(--color-brand-ink)] text-xs font-bold tracking-[0.2em] uppercase hover:bg-[var(--color-brand-ink)] hover:text-[var(--color-brand-cream)] transition"
                >
                  Hikayemiz
                </Link>
              </div>
            </div>
          </div>
          <div className="bg-[var(--color-brand-warm)] order-1 md:order-2 min-h-[40vh] md:min-h-full relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1600&q=80"
              alt="Via Mood Hero"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* USP strip */}
      <section className="bg-[var(--color-brand-ink)] text-[var(--color-brand-cream)] py-5">
        <div className="max-w-7xl mx-auto px-5 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: 'Ücretsiz Kargo', sub: '500 ₺ üzeri' },
            { label: 'Küçük Üretici', sub: 'Doğrudan tedarikçiden' },
            { label: '14 Gün İade', sub: 'Sorunsuz' },
            { label: 'Güvenli Ödeme', sub: 'Iyzico SSL' },
          ].map((x) => (
            <div key={x.label}>
              <div className="text-xs font-bold tracking-widest uppercase">{x.label}</div>
              <div className="text-[10px] tracking-widest uppercase text-[var(--color-brand-cream)]/60 mt-1">
                {x.sub}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Collections */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-20 md:py-28">
        <div className="text-center mb-14">
          <div className="text-xs font-medium tracking-[0.25em] uppercase text-[var(--color-brand-clay)] mb-3">
            Koleksiyonlar
          </div>
          <h2 className="headline text-4xl md:text-5xl">Üreticilerimiz</h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {COLLECTIONS.map((c) => (
            <Link
              key={c.handle}
              href={`/koleksiyon/${c.handle}`}
              className="group relative aspect-[3/4] overflow-hidden bg-[var(--color-brand-warm)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.img}
                alt={c.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-brand-ink)]/70 to-transparent" />
              <div className="absolute inset-x-6 bottom-6 text-[var(--color-brand-cream)]">
                <h3 className="headline text-2xl md:text-3xl mb-1">{c.title}</h3>
                <p className="text-xs tracking-wider uppercase opacity-80">{c.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <div className="text-xs font-medium tracking-[0.25em] uppercase text-[var(--color-brand-clay)] mb-3">
                Bu Hafta Öne Çıkan
              </div>
              <h2 className="headline text-4xl md:text-5xl">Ürünler</h2>
            </div>
            <Link
              href="/shop"
              className="text-xs font-bold tracking-[0.2em] uppercase link-underline"
            >
              Tümünü Gör →
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {featured.map((p) => (
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

      {/* Story block */}
      <section className="bg-[var(--color-brand-warm)] my-16">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-20 md:py-28 grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=1200&q=80"
              alt="Üretici hikayesi"
              className="aspect-[4/5] w-full object-cover"
            />
          </div>
          <div className="max-w-md">
            <div className="text-xs font-medium tracking-[0.25em] uppercase text-[var(--color-brand-clay)] mb-4">
              Hikayemiz
            </div>
            <h2 className="headline text-4xl md:text-5xl mb-6">
              Anadolu'nun Bereketini Modern Mutfaklara Taşıyoruz
            </h2>
            <p className="text-base md:text-lg text-[var(--color-brand-ink)]/70 leading-relaxed mb-6 font-light">
              Konya'nın baharatçısından Ayvalık'ın zeytinyağı üreticisine, küçük
              atölyelerden el dokuması tekstile — Türkiye'nin her köşesinden
              hikayesi olan ürünleri tek çatı altında topluyoruz.
            </p>
            <p className="text-base text-[var(--color-brand-ink)]/70 leading-relaxed mb-8 font-light">
              Her ürünün arkasında bir usta, bir aile, bir hikaye var.
            </p>
            <Link
              href="/hakkimizda"
              className="inline-flex items-center text-xs font-bold tracking-[0.2em] uppercase link-underline"
            >
              Daha Fazla Oku →
            </Link>
          </div>
        </div>
      </section>

      {/* Tedarikçi CTA */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-20 text-center">
        <div className="text-xs font-medium tracking-[0.25em] uppercase text-[var(--color-brand-clay)] mb-4">
          Üretici misiniz?
        </div>
        <h2 className="headline text-3xl md:text-4xl mb-4">
          Pazaryerimize Katılın
        </h2>
        <p className="text-[var(--color-brand-ink)]/70 mb-8 max-w-xl mx-auto">
          Küçük üretici, ev üreticisi, atölye sahibi misiniz? Via Mood'da
          ürünlerinizi binlerce müşteriye ulaştırın.
        </p>
        <Link
          href="/auth/sign-up"
          className="inline-flex items-center px-8 py-4 bg-[var(--color-brand-ink)] text-[var(--color-brand-cream)] text-xs font-bold tracking-[0.2em] uppercase hover:bg-[var(--color-brand-orange)] transition"
        >
          Tedarikçi Başvurusu →
        </Link>
      </section>
    </>
  );
}
