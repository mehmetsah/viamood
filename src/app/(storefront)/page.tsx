import { and, desc, eq, isNull, isNotNull } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { products } from '@/db/schema';
import { getStoreSettings } from '@/lib/settings/store';
import { GridCard, BorderedCard, type HomeProduct } from './_home/cards';
import { CategoryStrip, type Cat } from './_home/CategoryStrip';
import { ProductSlider } from './_home/ProductSlider';
import { Newsletter } from './_home/Newsletter';

export const dynamic = 'force-dynamic';

/** viamood.com.tr Shopify temasının (via-mood-home) birebir native portu. */
export default async function HomePage() {
  const rows = await db
    .select({
      handle: products.shopifyHandle,
      title: products.title,
      image: products.featuredImageUrl,
      min: products.minPriceCents,
    })
    .from(products)
    .where(and(eq(products.status, 'active'), isNull(products.deletedAt), isNotNull(products.shopifyHandle)))
    .orderBy(desc(products.createdAt))
    .limit(24);

  const all: HomeProduct[] = rows.map((r) => ({
    handle: r.handle as string,
    title: r.title,
    image: r.image,
    priceCents: Number(r.min ?? 0),
  }));

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
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

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

const CSS = `
.emp{--o:#f25334;--o2:#d84526;--teal:#1f7a8c;--ink:#000;--muted:#6b6b6b;--line:#e5e5e5;--alt:#f5f5f5;--cream:#f1ede4;background:#fff;color:#000;font-size:15px;line-height:1.55;overflow-x:hidden;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
.emp *{box-sizing:border-box;}
.emp-wrap{max-width:1440px;margin:0 auto;padding-inline:clamp(20px,3.5vw,56px);}
.emp-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#cfcfcf;font-size:28px;}

/* Buttons */
.emp-btn{display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;padding:14px 32px;border-radius:4px;border:0;cursor:pointer;text-decoration:none;transition:background .2s,opacity .2s;}
.emp-btn--orange{background:var(--o);color:#fff;}.emp-btn--orange:hover{background:var(--o2);}
.emp-btn--white{background:#fff;color:#000;}.emp-btn--white:hover{opacity:.9;}
.emp-btn--dark{background:#000;color:#fff;}.emp-btn--dark:hover{opacity:.88;}
.emp-btn--sm{padding:10px 20px;font-size:13px;}

/* Gifts / kategoriler */
.emp-gifts{padding-top:clamp(26px,3.5vw,44px);padding-bottom:clamp(18px,2.5vw,32px);}
.emp-gifts__grid--scroll{display:flex;flex-wrap:nowrap;justify-content:center;gap:clamp(14px,2vw,26px);overflow-x:auto;scroll-behavior:smooth;padding:4px clamp(8px,3vw,44px);scrollbar-width:none;}
.emp-gifts__grid--scroll::-webkit-scrollbar{display:none;}
.emp-gift{flex:0 0 auto;width:clamp(76px,9vw,104px);text-align:center;text-decoration:none;}
.emp-gift__circle{aspect-ratio:1/1;border-radius:50%;overflow:hidden;background:#f5f0e5;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;padding:20%;transition:transform .25s;}
.emp-gift:hover .emp-gift__circle{transform:scale(1.05);}
.emp-gift__circle img{width:100%;height:100%;object-fit:contain;}
.emp-gift__label{font-size:13px;font-weight:600;color:var(--teal);margin:0;}
.emp-gifts__arrow{position:absolute;top:clamp(44px,6vw,56px);transform:translateY(-50%);width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:#fff;color:#000;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.08);z-index:2;}
.emp-gifts__arrow:hover{background:#f5f0e5;}
.emp-gifts__arrow--prev{left:0;}.emp-gifts__arrow--next{right:0;}
@media(max-width:600px){.emp-gifts__arrow{display:none;}}

/* Hero */
.emp-hero{position:relative;min-height:clamp(480px,70vh,700px);overflow:hidden;background:#000;display:flex;align-items:center;}
.emp-hero__media{position:absolute;inset:0;z-index:0;}
.emp-hero__media img,.emp-hero__fallback{width:100%;height:100%;object-fit:cover;}
.emp-hero__fallback{background:linear-gradient(120deg,#14201d,#f25334);}
.emp-hero__media::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.15) 0%,rgba(0,0,0,.5) 100%);}
.emp-hero__content{position:relative;z-index:1;padding:60px 20px;max-width:820px;margin:0 auto;color:#fff;text-align:center;}
.emp-hero__title{font-size:clamp(2.2rem,5vw,4rem);font-weight:700;color:#fff;margin:0 0 16px;line-height:1.1;letter-spacing:-.02em;text-shadow:0 2px 12px rgba(0,0,0,.35);}
.emp-hero__lead{font-size:17px;color:#fff;margin:0 auto 36px;max-width:580px;line-height:1.5;text-shadow:0 1px 6px rgba(0,0,0,.3);}
.emp-hero__cta{display:inline-flex;gap:14px;flex-wrap:wrap;justify-content:center;}

/* Banners */
.emp-banners{padding-block:clamp(40px,5vw,80px);}
.emp-banners__grid{display:grid;grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr;gap:16px;height:clamp(560px,70vh,820px);}
.emp-bnr{position:relative;overflow:hidden;border-radius:4px;background:var(--cream);display:block;min-height:240px;text-decoration:none;}
.emp-bnr--xl{grid-row:1/3;}
.emp-bnr--wide{grid-column:2;grid-row:2;}
.emp-bnr--grad-dark{background:linear-gradient(135deg,#2b2b2b 0%,#4a3f38 60%,#f25334 160%);}
.emp-bnr--grad-teal{background:linear-gradient(135deg,#1a3c34 0%,#2d5f54 100%);}
.emp-bnr--grad-orange{background:linear-gradient(135deg,#f25334 0%,#ff8255 100%);}
.emp-bnr:hover{filter:brightness(1.07);}
.emp-bnr__copy{position:absolute;top:0;left:0;z-index:1;padding:clamp(24px,3.5vw,44px);max-width:80%;color:#fff;}
.emp-bnr__title{font-size:clamp(1.4rem,2.6vw,2.2rem);font-weight:700;margin:0 0 12px;line-height:1.15;letter-spacing:-.015em;color:#fff;}
.emp-bnr__lead{font-size:15px;margin:0 0 22px;line-height:1.5;max-width:320px;color:#fff;opacity:.92;}
@media(max-width:720px){.emp-banners__grid{grid-template-columns:1fr;grid-template-rows:auto;height:auto;}.emp-bnr--xl,.emp-bnr--wide{grid-row:auto;grid-column:auto;}.emp-bnr{min-height:240px;}}

/* Slider */
.emp-slider{padding-block:clamp(40px,5vw,64px);}
.emp-slider__head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:clamp(20px,2.5vw,32px);}
.emp-slider__all{font-size:13px;color:#000;text-decoration:none;white-space:nowrap;}
.emp-slider__all:hover{color:var(--o);}
.emp-slider__title{font-size:clamp(1.6rem,2.6vw,2.2rem);font-weight:700;flex:1;text-align:center;letter-spacing:-.015em;margin:0;}
.emp-slider__nav{display:flex;gap:8px;}
.emp-slider__arrow{width:42px;height:42px;border-radius:50%;border:1.5px solid #1a1a1a;background:#fff;color:#1a1a1a;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.2s;}
.emp-slider__arrow:hover{background:var(--o);color:#fff;border-color:var(--o);}
.emp-slider__track{display:grid;grid-auto-columns:minmax(220px,1fr);grid-auto-flow:column;gap:clamp(16px,2vw,24px);overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;padding:4px 0 24px;scrollbar-width:none;}
.emp-slider__track::-webkit-scrollbar{display:none;}
@media(max-width:640px){.emp-slider__title{order:1;flex-basis:100%;}.emp-slider__nav{order:2;margin:0 auto;}.emp-slider__all{display:none;}.emp-slider__arrow{width:36px;height:36px;}}

/* Bordered card (sli) */
.emp-sli{border:1px solid var(--line);border-radius:4px;padding:20px 16px;display:flex;flex-direction:column;min-width:220px;scroll-snap-align:start;text-decoration:none;color:#000;transition:box-shadow .2s;}
.emp-sli:hover{box-shadow:0 4px 16px rgba(0,0,0,.08);}
.emp-sli__media{position:relative;aspect-ratio:3/4;margin-bottom:16px;background:var(--alt);border-radius:4px;overflow:hidden;}
.emp-sli__media img{width:100%;height:100%;object-fit:cover;}
.emp-sli__vendor{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#000;margin:0 0 4px;}
.emp-sli__title{font-size:14px;font-weight:500;line-height:1.4;margin:0 0 6px;}
.emp-sli__price{color:var(--o);font-size:18px;font-weight:700;margin:0;}

/* Feature grid */
.emp-featgrid{padding-block:clamp(40px,5vw,64px);}
.emp-featgrid__grid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;}
.emp-fg-feature{position:relative;overflow:hidden;border-radius:4px;min-height:540px;display:flex;align-items:center;justify-content:center;text-decoration:none;}
.emp-fg-feature--grad{background:linear-gradient(135deg,#f25334 0%,#d8431f 70%,#2b2b2b 160%);}
.emp-fg-feature:hover{filter:brightness(1.07);}
.emp-fg-feature__copy{position:relative;z-index:1;text-align:center;color:#fff;padding:20px;}
.emp-fg-feature__label{font-size:13px;opacity:.9;font-weight:500;margin:0 0 8px;}
.emp-fg-feature__title{font-size:clamp(1.8rem,3vw,2.6rem);font-weight:700;color:#fff;margin:0 0 16px;}
.emp-fg-feature__link{color:#fff;font-weight:600;border-bottom:1px solid #fff;padding-bottom:2px;}
.emp-fg-prods{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.emp-fg-prods .emp-sli{min-width:0;}
@media(max-width:880px){.emp-featgrid__grid{grid-template-columns:1fr;}.emp-fg-feature{min-height:320px;}}

/* Section + product grid */
.emp-section{padding-block:clamp(40px,5vw,64px);}
.emp-secthead{margin-bottom:clamp(24px,3.5vw,40px);}
.emp-secthead__row{display:flex;justify-content:space-between;align-items:baseline;gap:20px;flex-wrap:wrap;}
.emp-secthead__title{font-size:clamp(1.6rem,2.6vw,2.2rem);font-weight:700;letter-spacing:-.015em;margin:0;}
.emp-secthead__link{font-size:14px;color:#000;border-bottom:1px solid #000;padding-bottom:1px;font-weight:500;text-decoration:none;}
.emp-secthead__link:hover{color:var(--o);border-color:var(--o);}
.emp-pgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(16px,2vw,28px);}
@media(max-width:980px){.emp-pgrid{grid-template-columns:repeat(3,1fr);gap:16px;}}
@media(max-width:720px){.emp-pgrid{grid-template-columns:repeat(2,1fr);gap:12px;}}
.emp-product{display:flex;flex-direction:column;text-decoration:none;color:#000;}
.emp-product__media{position:relative;aspect-ratio:3/4;overflow:hidden;background:var(--alt);margin-bottom:12px;border-radius:4px;}
.emp-product__img{width:100%;height:100%;object-fit:cover;transition:transform .4s;}
.emp-product:hover .emp-product__img{transform:scale(1.04);}
.emp-product__vendor{font-size:11px;color:#000;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;}
.emp-product__title{font-size:15px;font-weight:500;line-height:1.4;margin:0 0 4px;}
.emp-product__price{font-size:14px;color:#000;font-weight:600;margin:0;}

/* Trust */
.emp-trust{padding-block:clamp(22px,3vw,36px);border-block:1px solid var(--line);}
.emp-trust__grid{display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(20px,4vw,56px);}
.emp-trust__item{display:flex;align-items:center;gap:10px;color:#000;font-weight:600;font-size:14px;}
.emp-trust__item svg{color:var(--o);flex:0 0 auto;}
@media(max-width:600px){.emp-trust__item{font-size:12px;width:40%;}.emp-trust__grid{gap:14px 20px;}}

/* Story */
.emp-story{padding-block:clamp(48px,6vw,80px);background:var(--alt);}
.emp-story__grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(32px,4vw,80px);align-items:center;}
.emp-story__media{aspect-ratio:4/3;overflow:hidden;background:#fff;border-radius:4px;}
.emp-story__media img{width:100%;height:100%;object-fit:cover;}
.emp-story__copy{max-width:480px;}
.emp-story__title{font-size:clamp(1.6rem,2.8vw,2.4rem);font-weight:700;margin:0 0 16px;line-height:1.2;letter-spacing:-.015em;}
.emp-story__lead{font-size:16px;line-height:1.6;color:var(--muted);margin:0 0 24px;}
@media(max-width:880px){.emp-story__grid{grid-template-columns:1fr;}}

/* Newsletter */
.emp-news{padding-block:clamp(56px,7vw,88px);background:#000;color:#fff;text-align:center;}
.emp-news__inner{max-width:540px;margin:0 auto;padding-inline:20px;}
.emp-news__title{color:#fff;font-size:clamp(1.4rem,2.4vw,1.8rem);font-weight:700;margin:0 0 12px;}
.emp-news__lead{color:#ccc;font-size:15px;margin:0 0 28px;}
.emp-news__form{display:flex;gap:10px;}
.emp-news__input{flex:1;background:#fff;border:0;border-radius:4px;color:#000;font-size:15px;padding:14px 16px;}
.emp-news__btn{background:var(--o);color:#fff;border:0;border-radius:4px;font-size:14px;font-weight:600;padding:0 24px;cursor:pointer;}
.emp-news__btn:hover{background:var(--o2);}
@media(max-width:480px){.emp-news__form{flex-direction:column;}}
`;
