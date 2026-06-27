import { and, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { products } from '@/db/schema';
import { getStorefrontProducts } from '@/lib/storefront/products';
import { GridCard } from '../_home/cards';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; cat?: string }>;
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const cat = (sp.cat ?? '').trim();

  const list = await getStorefrontProducts({ q, cat, limit: 60 });

  const catRows = await db
    .selectDistinct({ pt: products.productType })
    .from(products)
    .where(and(eq(products.status, 'active'), isNull(products.deletedAt)));
  const categories = catRows
    .map((r) => r.pt)
    .filter((x): x is string => !!x)
    .sort((a, b) => a.localeCompare(b, 'tr'));

  const heading = cat || (q ? `“${q}” araması` : 'Tüm Ürünler');
  const catHref = (c: string) => `/magaza?${new URLSearchParams({ ...(c ? { cat: c } : {}), ...(q ? { q } : {}) }).toString()}`;

  return (
    <div className="emp">
      <section className="emp-col">
        <div className="emp-wrap">
          <div className="emp-col__head">
            <div>
              <h1 className="emp-col__h1">{heading}</h1>
              <p className="emp-col__count">{list.length} ürün</p>
            </div>
          </div>

          <div className="emp-col__layout">
            {/* Filtre sidebar */}
            <aside className="emp-col__side">
              <form className="emp-col__search">
                <input className="emp-input" name="q" defaultValue={q} placeholder="Ürün ara…" />
                {cat ? <input type="hidden" name="cat" value={cat} /> : null}
                <button className="emp-btn emp-btn--dark emp-btn--sm" aria-label="Ara">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
                </button>
              </form>
              <p className="emp-facet__title">Kategoriler</p>
              <nav className="emp-facet__list">
                <Link href={catHref('')} className={!cat ? 'on' : ''}>Tüm Ürünler</Link>
                {categories.map((c) => (
                  <Link key={c} href={catHref(c)} className={cat === c ? 'on' : ''}>{c}</Link>
                ))}
              </nav>
            </aside>

            {/* Ürün grid */}
            <div>
              {list.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                  Eşleşen ürün bulunamadı.{' '}
                  <Link href="/magaza" style={{ color: 'var(--o)' }}>Tümünü gör</Link>
                </div>
              ) : (
                <div className="emp-pgrid">
                  {list.map((p) => <GridCard key={p.handle} p={p} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
