'use client';
import Link from 'next/link';
import { useRef } from 'react';

export interface Cat {
  label: string;
  url: string;
  image?: string | null;
}

/** Yatay kayan yuvarlak kategori şeridi (hero üstü). via-mood-home .emp-gifts */
export function CategoryStrip({ items }: { items: Cat[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  return (
    <section className="emp-gifts emp-gifts--top">
      <div className="emp-wrap" style={{ position: 'relative' }}>
        <button className="emp-gifts__arrow emp-gifts__arrow--prev" onClick={() => scroll(-1)} aria-label="Önceki">‹</button>
        <button className="emp-gifts__arrow emp-gifts__arrow--next" onClick={() => scroll(1)} aria-label="Sonraki">›</button>
        <div ref={ref} className="emp-gifts__grid emp-gifts__grid--scroll">
          {items.map((c) => (
            <Link key={c.label} href={c.url} className="emp-gift">
              <div className="emp-gift__circle">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt={c.label} />
                ) : null}
              </div>
              <p className="emp-gift__label">{c.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
