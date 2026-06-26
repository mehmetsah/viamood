import Link from 'next/link';
import { getStoreSettings } from '@/lib/settings/store';
import { getStorefrontProducts } from '@/lib/storefront/products';
import { GridCard, BorderedCard } from './_home/cards';
import { CategoryStrip, type Cat } from './_home/CategoryStrip';
import { ProductSlider } from './_home/ProductSlider';
import { Newsletter } from './_home/Newsletter';

export const dynamic = 'force-dynamic';

/** viamood.com.tr Shopify temasının (via-mood-home) birebir native portu. CSS layout'tan (_theme.ts). */
export default async function HomePage() {
  const all = await getStorefrontProducts({ limit: 24 });
  const { theme } = await getStoreSettings();

  const heroImg = theme.hero_image || all.find((p) => p.image)?.image || null;
  const heroTitle = theme.hero_title || 'Eviniz için, özenle seçilmiş ürünler';
  const heroLead = theme.hero_subtitle || 'Mutfaktan banyoya, dolap içinden tezgah üstüne — günlük rutini sade, düzenli ve estetik kılan ürünler.';

  const slider = all.slice(0, 10);
  const featureProds = all.slice(0, 4);
  const grid = all.slice(0, 8);

  const categories: Cat[] = [
    { label: 'Çok Satanlar', url: '/magaza' },
    { label: 'Mutfak', url: '/magaza?cat=Mutfak' },
    { label: 'Hobi Ürünleri', url: '/magaza?cat=Hobi' },
    { label: '500 TL Altı', url: '/magaza' },
    { label: 'İndirim', url: '/magaza' },
    { label: 'Tümünü Keşfet', url: '/magaza' },
  ];

  const banners = [
    { cls: 'emp-bnr--xl emp-bnr--grad-dark', title: 'Mutfağınız Daha Düzenli', lead: 'Günlük rutini kolaylaştıran pratik ürünler.', btn: 'Mağazaya git', url: '/magaza' },
    { cls: 'emp-bnr--grad-teal', title: 'Düzenli Bir Ev', lead: 'Her köşeye uygun şık ve işlevsel organizer çözümleri.', btn: 'Hepsini gör', url: '/magaza' },
    { cls: 'emp-bnr--wide emp-bnr--grad-orange', title: 'Çok Al, Az Öde!', lead: 'Kampanya setlerinde büyük tasarruf.', btn: 'İndirimleri gör', url: '/magaza' },
  ];

  const trust = [
    { label: 'Ücretsiz Kargo', svg: '<rect x="1" y="6" width="13" height="11" rx="1"/><path d="M14 9h4l3 3v5h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>' },
    { label: 'Kapıda Ödeme', svg: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>' },
    { label: 'Güvenli Ödeme', svg: '<path d="M12 2l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5z"/><path d="M9 12l2 2 4-4"/>' },
    { label: 'Sağlıklı Malzeme', svg: '<path d="M12 3c4 4 7 6 7 11a7 7 0 0 1-14 0c0-2 1-3 2-5"/><path d="M9 14c0-2 1.5-3 3-5"/>' },
    { label: 'Yerli Üretim', svg: '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/>' },
  ];

  return (
    <div className="emp">
      <CategoryStrip items={categories} />

      {/* HERO */}
      <section className="emp-hero">
        <div className="emp-hero__media">
          {heroImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImg} alt="" />
          ) : (
            <div className="emp-hero__fallback" />
          )}
        </div>
        <div className="emp-hero__content">
          <h1 className="emp-hero__title">{heroTitle}</h1>
          <p className="emp-hero__lead">{heroLead}</p>
          <div className="emp-hero__cta">
            <Link href={theme.hero_cta_link || '/magaza'} className="emp-btn emp-btn--orange">{theme.hero_cta_text || 'Mağazaya git'}</Link>
            <Link href="/magaza" className="emp-btn emp-btn--white">Tüm ürünler</Link>
          </div>
        </div>
      </section>

      {/* BANNERLAR */}
      <section className="emp-banners">
        <div className="emp-wrap">
          <div className="emp-banners__grid">
            {banners.map((b) => (
              <Link key={b.title} href={b.url} className={`emp-bnr ${b.cls}`}>
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

      {/* SLIDER */}
      <ProductSlider title="En Tercih Edilenler" products={slider} href="/magaza" />

      {/* ONE_CIKAN_GRID — feature + 2x2 */}
      <section className="emp-featgrid">
        <div className="emp-wrap">
          <div className="emp-featgrid__grid">
            <Link href="/magaza" className="emp-fg-feature emp-fg-feature--grad">
              <div className="emp-fg-feature__copy">
                <p className="emp-fg-feature__label">Sezon Sonu İndirimi</p>
                <h3 className="emp-fg-feature__title">%40&apos;a varan indirim</h3>
                <span className="emp-fg-feature__link">İndirimleri gör →</span>
              </div>
            </Link>
            <div className="emp-fg-prods">
              {featureProds.map((p) => <BorderedCard key={p.handle} p={p} />)}
            </div>
          </div>
        </div>
      </section>

      {/* URUN_GRID — Yeni gelenler */}
      <section className="emp-section">
        <div className="emp-wrap">
          <div className="emp-secthead">
            <div className="emp-secthead__row">
              <h2 className="emp-secthead__title">Yeni gelenler</h2>
              <Link href="/magaza" className="emp-secthead__link">Tümünü gör →</Link>
            </div>
          </div>
          <div className="emp-pgrid">
            {grid.map((p) => <GridCard key={p.handle} p={p} />)}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="emp-trust">
        <div className="emp-wrap">
          <div className="emp-trust__grid">
            {trust.map((t) => (
              <div key={t.label} className="emp-trust__item">
                {/* eslint-disable-next-line react/no-danger */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" dangerouslySetInnerHTML={{ __html: t.svg }} />
                <span>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STORY */}
      <section className="emp-story">
        <div className="emp-wrap">
          <div className="emp-story__grid">
            <div className="emp-story__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://images.unsplash.com/photo-1556909114-44e3e9399a2a?w=1200&q=80&auto=format&fit=crop" alt="" />
            </div>
            <div className="emp-story__copy">
              <h2 className="emp-story__title">Doğanın renkleriyle modern yaşam</h2>
              <p className="emp-story__lead">Via Mood, ev pratiğini sade ve estetik kılan ürünleri tek çatı altında topladı. Her ürün özenle seçildi.</p>
              <Link href="/magaza" className="emp-btn emp-btn--dark">Ürünleri keşfet</Link>
            </div>
          </div>
        </div>
      </section>

      <Newsletter />
    </div>
  );
}
