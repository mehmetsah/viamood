import { and, desc, eq, ilike, isNull } from 'drizzle-orm';
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

interface PageProps {
  searchParams: Promise<{ q?: string; cat?: string }>;
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const cat = (sp.cat ?? '').trim();

  const conds = [eq(products.status, 'active'), isNull(products.deletedAt)];
  if (q) conds.push(ilike(products.title, `%${q}%`));
  if (cat) conds.push(eq(products.productType, cat));

  const rows = await db
    .select({
      handle: products.shopifyHandle,
      title: products.title,
      image: products.featuredImageUrl,
      min: products.minPriceCents,
      max: products.maxPriceCents,
    })
    .from(products)
    .where(and(...conds))
    .orderBy(desc(products.createdAt))
    .limit(60);

  // Kategoriler (distinct ürün tipi)
  const catRows = await db
    .selectDistinct({ pt: products.productType })
    .from(products)
    .where(and(eq(products.status, 'active'), isNull(products.deletedAt)));
  const categories = catRows.map((r) => r.pt).filter((x): x is string => !!x).sort((a, b) => a.localeCompare(b, 'tr'));

  const { theme } = await getStoreSettings();
  const hasHero = !!(theme.hero_title || theme.hero_image) && !q && !cat;

  return (
    <div>
      {hasHero && (
        <section
          className="relative bg-[var(--color-brand-ink)] text-white"
          style={theme.hero_image ? { backgroundImage: `url(${theme.hero_image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          <div className="bg-black/40">
            <div className="max-w-6xl mx-auto px-4 py-20 text-center">
              {theme.hero_title && <h2 className="text-4xl font-bold">{theme.hero_title}</h2>}
              {theme.hero_subtitle && <p className="mt-3 text-lg opacity-90">{theme.hero_subtitle}</p>}
              {theme.hero_cta_text && (
                <Link href={theme.hero_cta_link || '/magaza'} className="inline-block mt-6 px-7 py-3 rounded-full bg-[var(--color-brand-orange)] font-semibold">
                  {theme.hero_cta_text}
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Ürünler</h1>
          <p className="text-sm text-neutral-500">{rows.length} ürün{cat ? ` · ${cat}` : ''}{q ? ` · "${q}"` : ''}</p>
        </div>
        <form className="flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Ürün ara…"
            className="h-10 w-56 px-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-[var(--color-brand-orange)]"
          />
          <select name="cat" defaultValue={cat} className="h-10 px-3 rounded-lg border border-neutral-300 text-sm bg-white">
            <option value="">Tüm kategoriler</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="h-10 px-4 rounded-lg bg-[var(--color-brand-ink)] text-white text-sm font-medium">Filtrele</button>
          {(q || cat) && (
            <Link href="/magaza" className="h-10 px-3 flex items-center text-sm text-neutral-500 hover:underline">Temizle</Link>
          )}
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-20 text-neutral-500">
          Henüz yayında ürün yok. Panelden ürün ekleyip “Yayında” yapınca burada görünür.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {rows.map((p) => (
            <Link
              key={p.handle}
              href={`/magaza/${p.handle}`}
              className="group bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="aspect-square bg-neutral-100 overflow-hidden">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-300 text-4xl">🛍️</div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{p.title}</h3>
                <div className="mt-2 font-bold text-[var(--color-brand-orange)]">{priceLabel(p.min, p.max)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
