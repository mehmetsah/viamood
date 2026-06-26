import Link from 'next/link';
import { discountPct, type SfProduct } from '@/lib/storefront/types';

export function money(cents: number): string {
  return (cents / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

export type { SfProduct as HomeProduct };

/** Kenarlıklı kart (slider + featgrid) — turuncu 18px fiyat. via-mood-home .emp-sli */
export function BorderedCard({ p }: { p: SfProduct }) {
  const pct = discountPct(p);
  return (
    <Link href={`/magaza/${p.handle}`} className="emp-sli">
      <div className="emp-sli__media">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.title} loading="lazy" />
        ) : (
          <div className="emp-ph">📦</div>
        )}
        {pct ? <span className="emp-badge">%{pct} indirim</span> : null}
      </div>
      {p.vendor ? <p className="emp-sli__vendor">{p.vendor}</p> : null}
      <h3 className="emp-sli__title">{p.title}</h3>
      <p className="emp-sli__price">
        {p.compareAtCents ? <s className="emp-was">{money(p.compareAtCents)}</s> : null}
        {money(p.priceCents)}
      </p>
    </Link>
  );
}

/** Izgara kartı (urun_grid) — siyah 14px fiyat, kenarlıksız. via-mood-home .emp-product */
export function GridCard({ p }: { p: SfProduct }) {
  const pct = discountPct(p);
  return (
    <Link href={`/magaza/${p.handle}`} className="emp-product">
      <div className="emp-product__media">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.title} className="emp-product__img" loading="lazy" />
        ) : (
          <div className="emp-ph">📦</div>
        )}
        {pct ? <span className="emp-badge">%{pct}</span> : null}
      </div>
      {p.vendor ? <p className="emp-product__vendor">{p.vendor}</p> : null}
      <h3 className="emp-product__title">{p.title}</h3>
      <p className="emp-product__price">
        {p.compareAtCents ? <s className="emp-was">{money(p.compareAtCents)}</s> : null}
        {money(p.priceCents)}
      </p>
    </Link>
  );
}
