'use client';
import { useRef } from 'react';
import Link from 'next/link';
import { BorderedCard, type HomeProduct } from './cards';

/** "En Tercih Edilenler" yatay ürün slider'ı — nav okları sağ üstte. via-mood-home .emp-slider */
export function ProductSlider({ title, products, href }: { title: string; products: HomeProduct[]; href: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 248, behavior: 'smooth' });
  if (!products.length) return null;
  return (
    <section className="emp-slider">
      <div className="emp-wrap">
        <div className="emp-slider__head">
          <Link href={href} className="emp-slider__all">Tümünü gör →</Link>
          <h2 className="emp-slider__title">{title}</h2>
          <div className="emp-slider__nav">
            <button className="emp-slider__arrow" onClick={() => scroll(-1)} aria-label="Önceki">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button className="emp-slider__arrow" onClick={() => scroll(1)} aria-label="Sonraki">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>
        <div ref={ref} className="emp-slider__track">
          {products.map((p) => <BorderedCard key={p.handle} p={p} />)}
        </div>
      </div>
    </section>
  );
}
