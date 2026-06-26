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

  // Kategoriler (distinct ürün tipi)
  const catRows = await db
    .selectDistinct({ pt: products.productType })
    .from(products)
    .where(and(eq(products.status, 'active'), isNull(products.deletedAt)));
  const categories = catRows.map((r) => r.pt).filter((x): x is string => !!x).sort((a, b) => a.localeCompare(b, 'tr'));

  return (
    <div className="emp">
      <section className="emp-section">
        <div className="emp-wrap">
          <div className="emp-catbar">
            <div>
              <h1 className="emp-secthead__title">{cat || (q ? 'Arama' : 'Tüm Ürünler')}</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
                {list.length} ürün{q ? ` · "${q}"` : ''}
              </p>
            </div>
            <form className="emp-catbar__form">
              <input className="emp-input" name="q" defaultValue={q} placeholder="Ürün ara…" style={{ width: 220 }} />
              <select className="emp-input" name="cat" defaultValue={cat}>
                <option value="">Tüm kategoriler</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="emp-btn emp-btn--dark emp-btn--sm">Filtrele</button>
              {(q || cat) && (
                <Link href="/magaza" className="emp-btn emp-btn--white emp-btn--sm" style={{ border: '1px solid var(--line)' }}>Temizle</Link>
              )}
            </form>
          </div>

          {list.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
              Eşleşen ürün bulunamadı.
            </div>
          ) : (
            <div className="emp-pgrid">
              {list.map((p) => <GridCard key={p.handle} p={p} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
