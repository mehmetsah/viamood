import { and, desc, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { products } from '@/db/schema';
import { getStoreSettings } from '@/lib/settings/store';

export const dynamic = 'force-dynamic';

function priceLabel(min: bigint | null, max: bigint | null): string {
  const lo = Number(min ?? 0) / 100;
  const hi = Number(max ?? 0) / 100;
  const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
  return lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
}

/** Mağaza anasayfası (storefront `/`) — hero + öne çıkan ürünler. Tema /admin/theme'den yönetilir. */
export default async function HomePage() {
  const featured = await db
    .select({
      handle: products.shopifyHandle,
      title: products.title,
      image: products.featuredImageUrl,
      min: products.minPriceCents,
      max: products.maxPriceCents,
    })
    .from(products)
    .where(and(eq(products.status, 'active'), isNull(products.deletedAt)))
    .orderBy(desc(products.createdAt))
    .limit(8);

  const { theme } = await getStoreSettings();
  const heroTitle = theme.hero_title || 'Doğanın en iyisi, kapında';
  const heroSubtitle = theme.hero_subtitle || 'Seçkin üreticilerden doğal ürünler — Via Mood güvencesiyle.';

  return (
    <div>
      {/* Hero */}
      <section
        className="relative text-white"
        style={{
          background: theme.hero_image
            ? `linear-gradient(rgba(20,32,29,.55),rgba(20,32,29,.55)), url(${theme.hero_image}) center/cover`
            : 'linear-gradient(120deg, var(--color-brand-ink,#14201d), var(--color-brand-orange,#e1691f))',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-20 sm:py-28">
          <h1 className="text-4xl sm:text-5xl font-bold max-w-2xl leading-tight">{heroTitle}</h1>
          <p className="mt-4 text-lg opacity-90 max-w-xl">{heroSubtitle}</p>
          <Link
            href={theme.hero_cta_link || '/magaza'}
            className="inline-block mt-8 px-8 py-3.5 rounded-full bg-[var(--color-brand-orange)] font-semibold hover:opacity-90 transition"
          >
            {theme.hero_cta_text || 'Alışverişe Başla'}
          </Link>
        </div>
      </section>

      {/* Öne çıkan ürünler */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="flex items-end justify-between mb-8">
          <h2 className="text-2xl font-bold">Öne Çıkan Ürünler</h2>
          <Link href="/magaza" className="text-sm font-medium text-[var(--color-brand-orange)] hover:underline">
            Tüm ürünler →
          </Link>
        </div>

        {featured.length === 0 ? (
          <p className="text-neutral-500">Henüz yayında ürün yok.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {featured.map((p) => (
              <Link
                key={p.handle}
                href={`/magaza/${p.handle}`}
                className="group bg-white rounded-2xl border border-neutral-200 overflow-hidden hover:shadow-lg transition"
              >
                <div className="aspect-square bg-neutral-100 overflow-hidden">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300">📦</div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium line-clamp-2">{p.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-[var(--color-brand-orange)]">{priceLabel(p.min, p.max)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
