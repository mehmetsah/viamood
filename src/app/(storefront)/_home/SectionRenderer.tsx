import Link from 'next/link';
import type { HomeSection } from '@/lib/storefront/sections';
import type { SfProduct } from '@/lib/storefront/types';
import { GridCard, BorderedCard } from './cards';
import { CategoryStrip, type Cat } from './CategoryStrip';
import { ProductSlider } from './ProductSlider';
import { Newsletter } from './Newsletter';

const S = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const N = (v: unknown, d = 0): number => (typeof v === 'number' ? v : typeof v === 'string' && v ? Number(v) || d : d);
const L = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const TRUST_SVGS = [
  '<rect x="1" y="6" width="13" height="11" rx="1"/><path d="M14 9h4l3 3v5h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  '<path d="M12 2l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5z"/><path d="M9 12l2 2 4-4"/>',
  '<path d="M12 3c4 4 7 6 7 11a7 7 0 0 1-14 0c0-2 1-3 2-5"/><path d="M9 14c0-2 1.5-3 3-5"/>',
  '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/>',
];

/** Tek bir home section'ı render eder (config-tabanlı). */
export function SectionRenderer({ section, products }: { section: HomeSection; products: SfProduct[] }) {
  const st = section.settings;

  switch (section.type) {
    case 'categories': {
      const items = L<Cat>(st.items);
      return <CategoryStrip items={items} />;
    }
    case 'hero': {
      const img = S(st.image) || null;
      return (
        <section className="emp-hero">
          <div className="emp-hero__media">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" />
            ) : <div className="emp-hero__fallback" />}
          </div>
          <div className="emp-hero__content">
            <h1 className="emp-hero__title">{S(st.title, 'Eviniz için, özenle seçilmiş ürünler')}</h1>
            <p className="emp-hero__lead">{S(st.subtitle)}</p>
            <div className="emp-hero__cta">
              <Link href={S(st.cta1Link, '/magaza')} className="emp-btn emp-btn--orange">{S(st.cta1Text, 'Mağazaya git')}</Link>
              {S(st.cta2Text) ? <Link href={S(st.cta2Link, '/magaza')} className="emp-btn emp-btn--white">{S(st.cta2Text)}</Link> : null}
            </div>
          </div>
        </section>
      );
    }
    case 'banners': {
      const items = L<{ image: string; title: string; lead: string; btn: string; url: string }>(st.items);
      const cls = ['emp-bnr--xl', '', 'emp-bnr--wide'];
      return (
        <section className="emp-banners">
          <div className="emp-wrap">
            <div className="emp-banners__grid">
              {items.map((b, i) => (
                <Link key={i} href={S(b.url, '/magaza')} className={`emp-bnr ${cls[i] ?? ''}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {b.image ? <img src={b.image} alt={b.title} className="emp-bnr__img" /> : null}
                  <div className="emp-bnr__copy">
                    <h3 className="emp-bnr__title">{b.title}</h3>
                    <p className="emp-bnr__lead">{b.lead}</p>
                    <span className="emp-btn emp-btn--white emp-btn--sm">{b.btn}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      );
    }
    case 'productSlider':
      return <ProductSlider title={S(st.title, 'En Tercih Edilenler')} products={products.slice(0, N(st.limit, 10))} href="/magaza" />;
    case 'featureGrid': {
      const feat = products.slice(0, 4);
      return (
        <section className="emp-featgrid">
          <div className="emp-wrap">
            <div className="emp-featgrid__grid">
              <Link href={S(st.featureLink, '/magaza')} className="emp-fg-feature emp-fg-feature--grad">
                <div className="emp-fg-feature__copy">
                  <p className="emp-fg-feature__label">{S(st.featureLabel, 'Sezon Sonu İndirimi')}</p>
                  <h3 className="emp-fg-feature__title">{S(st.featureTitle, "%40'a varan indirim")}</h3>
                  <span className="emp-fg-feature__link">İndirimleri gör →</span>
                </div>
              </Link>
              <div className="emp-fg-prods">{feat.map((p) => <BorderedCard key={p.handle} p={p} />)}</div>
            </div>
          </div>
        </section>
      );
    }
    case 'productGrid': {
      const grid = products.slice(0, N(st.limit, 8));
      return (
        <section className="emp-section">
          <div className="emp-wrap">
            <div className="emp-secthead"><div className="emp-secthead__row">
              <h2 className="emp-secthead__title">{S(st.title, 'Yeni gelenler')}</h2>
              <Link href="/magaza" className="emp-secthead__link">Tümünü gör →</Link>
            </div></div>
            <div className="emp-pgrid">{grid.map((p) => <GridCard key={p.handle} p={p} />)}</div>
          </div>
        </section>
      );
    }
    case 'trust': {
      const items = L<{ label: string }>(st.items);
      return (
        <section className="emp-trust">
          <div className="emp-wrap">
            <div className="emp-trust__grid">
              {items.map((t, i) => (
                <div key={i} className="emp-trust__item">
                  {/* eslint-disable-next-line react/no-danger */}
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" dangerouslySetInnerHTML={{ __html: TRUST_SVGS[i % TRUST_SVGS.length] ?? '' }} />
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }
    case 'story':
      return (
        <section className="emp-story">
          <div className="emp-wrap">
            <div className="emp-story__grid">
              <div className="emp-story__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {S(st.image) ? <img src={S(st.image)} alt="" /> : null}
              </div>
              <div className="emp-story__copy">
                <h2 className="emp-story__title">{S(st.title)}</h2>
                <p className="emp-story__lead">{S(st.lead)}</p>
                <Link href={S(st.btnLink, '/magaza')} className="emp-btn emp-btn--dark">{S(st.btnText, 'Ürünleri keşfet')}</Link>
              </div>
            </div>
          </div>
        </section>
      );
    case 'newsletter':
      return <Newsletter title={S(st.title)} lead={S(st.lead)} />;
    default:
      return null;
  }
}
