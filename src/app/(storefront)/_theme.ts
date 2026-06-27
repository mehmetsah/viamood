/** viamood.com.tr (via-mood-home) temasından birebir port edilen storefront CSS'i.
 *  Storefront layout'ta <style> ile bir kez enjekte edilir; tüm sayfalar `.emp` ile kullanır. */
export const STOREFRONT_CSS = `
.emp{--o:#f25334;--o2:#d84526;--teal:#1f7a8c;--ink:#000;--muted:#6b6b6b;--line:#e5e5e5;--alt:#f5f5f5;--cream:#f1ede4;--sale:#ef4444;color:#000;font-size:15px;line-height:1.55;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
.emp *{box-sizing:border-box;}
.emp-wrap{max-width:1440px;margin:0 auto;padding-inline:clamp(20px,3.5vw,56px);}
.emp-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#cfcfcf;font-size:28px;}
.emp-badge{position:absolute;top:8px;left:8px;background:var(--sale);color:#fff;font-size:11px;font-weight:600;padding:4px 8px;border-radius:2px;z-index:2;}
.emp-badge--sold{background:#000;}
.emp-was{color:var(--muted);font-weight:400;font-size:.82em;margin-right:6px;text-decoration:line-through;}

/* Buttons */
.emp-btn{display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;padding:14px 32px;border-radius:4px;border:0;cursor:pointer;text-decoration:none;transition:background .2s,opacity .2s;}
.emp-btn--orange{background:var(--o);color:#fff;}.emp-btn--orange:hover{background:var(--o2);}
.emp-btn--white{background:#fff;color:#000;}.emp-btn--white:hover{opacity:.9;}
.emp-btn--dark{background:#000;color:#fff;}.emp-btn--dark:hover{opacity:.88;}
.emp-btn--sm{padding:10px 20px;font-size:13px;}
.emp-btn--block{width:100%;}
.emp-btn:disabled{opacity:.45;cursor:not-allowed;}

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
.emp-bnr:hover{filter:brightness(1.05);}
.emp-bnr__img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;transition:transform .8s cubic-bezier(.22,1,.36,1);}
.emp-bnr:hover .emp-bnr__img{transform:scale(1.04);}
.emp-bnr::after{content:'';position:absolute;inset:0;z-index:1;background:linear-gradient(115deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.22) 45%,rgba(0,0,0,0) 78%);}
.emp-bnr__copy{position:absolute;top:0;left:0;z-index:2;padding:clamp(24px,3.5vw,44px);max-width:80%;color:#fff;}
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

/* Catalog filter bar (eski — korunur) */
.emp-catbar{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:clamp(20px,3vw,32px);}
.emp-catbar__form{display:flex;flex-wrap:wrap;gap:8px;}
.emp-input{height:42px;padding:0 14px;border:1px solid var(--line);border-radius:4px;font-size:14px;background:#fff;outline:none;}
.emp-input:focus{border-color:var(--o);}

/* Collection page (tema koleksiyon: sidebar filtre + grid) */
.emp-col{padding-block:clamp(20px,3vw,40px);}
.emp-col__head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:clamp(18px,2.5vw,28px);padding-bottom:16px;border-bottom:1px solid var(--line);}
.emp-col__h1{font-size:clamp(1.5rem,2.6vw,2rem);font-weight:700;letter-spacing:-.015em;margin:0;}
.emp-col__count{font-size:13px;color:var(--muted);margin-top:4px;}
.emp-col__layout{display:grid;grid-template-columns:220px 1fr;gap:clamp(20px,3vw,40px);align-items:start;}
.emp-col__side{position:sticky;top:88px;}
.emp-col__search{display:flex;gap:6px;margin-bottom:22px;}
.emp-col__search .emp-input{flex:1;min-width:0;height:40px;}
.emp-facet__title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:0 0 10px;color:var(--muted);}
.emp-facet__list{display:flex;flex-direction:column;gap:1px;}
.emp-facet__list a{font-size:14px;color:#333;text-decoration:none;padding:8px 12px;border-radius:4px;transition:.12s;}
.emp-facet__list a:hover{background:var(--alt);color:#000;}
.emp-facet__list a.on{background:#000;color:#fff;font-weight:600;}
.emp-col__layout .emp-pgrid{grid-template-columns:repeat(3,1fr);}
@media(max-width:1180px){.emp-col__layout .emp-pgrid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:880px){
  .emp-col__layout{grid-template-columns:1fr;}
  .emp-col__side{position:static;}
  .emp-facet__list{flex-direction:row;flex-wrap:wrap;gap:8px;overflow-x:auto;}
  .emp-facet__list a{border:1px solid var(--line);white-space:nowrap;}
  .emp-col__layout .emp-pgrid{grid-template-columns:repeat(2,1fr);}
}
@media(max-width:560px){.emp-col__layout .emp-pgrid{grid-template-columns:repeat(2,1fr);gap:12px;}}

/* PDP */
.emp-pdp{padding-block:clamp(28px,4vw,48px);}
.emp-pdp__grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,4vw,56px);align-items:start;}
@media(max-width:880px){.emp-pdp__grid{grid-template-columns:1fr;}}
.emp-pdp__gallery{display:flex;flex-direction:column;gap:12px;}
.emp-pdp__main{position:relative;aspect-ratio:1/1;background:var(--alt);border-radius:4px;overflow:hidden;}
.emp-pdp__main img{width:100%;height:100%;object-fit:cover;}
.emp-pdp__thumbs{display:flex;gap:10px;flex-wrap:wrap;}
.emp-pdp__thumb{width:72px;height:72px;border-radius:4px;overflow:hidden;border:1px solid var(--line);background:var(--alt);}
.emp-pdp__thumb img{width:100%;height:100%;object-fit:cover;}
.emp-pdp__vendor{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0 0 8px;}
.emp-pdp__title{font-size:clamp(1.5rem,3vw,2rem);font-weight:700;line-height:1.2;margin:0 0 14px;letter-spacing:-.015em;}
.emp-pdp__price{display:flex;align-items:baseline;gap:10px;margin:0 0 20px;}
.emp-pdp__price b{color:var(--o);font-size:26px;font-weight:700;}
.emp-pdp__sku{font-size:12px;color:var(--muted);margin:0 0 20px;}
.emp-pdp__opt{margin:0 0 18px;}
.emp-pdp__opt-label{font-size:13px;font-weight:600;margin:0 0 8px;}
.emp-pdp__chips{display:flex;flex-wrap:wrap;gap:8px;}
.emp-chip{padding:9px 16px;border:1px solid #d4d4d4;border-radius:4px;font-size:14px;background:#fff;cursor:pointer;transition:.15s;}
.emp-chip:hover{border-color:#000;}
.emp-chip--on{border-color:#000;background:#000;color:#fff;}
.emp-chip:disabled{opacity:.4;cursor:not-allowed;text-decoration:line-through;}
.emp-qtyrow{display:flex;gap:12px;align-items:center;margin:0 0 20px;}
.emp-qty{display:flex;align-items:center;border:1px solid var(--line);border-radius:4px;overflow:hidden;}
.emp-qty button{width:40px;height:46px;border:0;background:#fff;font-size:18px;cursor:pointer;}
.emp-qty button:hover{background:var(--alt);}
.emp-qty span{width:44px;text-align:center;font-weight:600;}
.emp-pdp__desc{margin-top:32px;padding-top:28px;border-top:1px solid var(--line);font-size:15px;line-height:1.7;color:#333;max-width:680px;}
.emp-pdp__desc h2{font-size:18px;font-weight:700;margin:0 0 12px;}
.emp-assure{display:flex;flex-wrap:wrap;gap:14px 28px;margin:22px 0 0;padding:18px 0 0;border-top:1px solid var(--line);}
.emp-assure__i{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#000;}
.emp-assure__i svg{color:var(--o);}

/* Cart */
.emp-cart{padding-block:clamp(28px,4vw,48px);}
.emp-cart h1{font-size:clamp(1.5rem,2.6vw,2rem);font-weight:700;margin:0 0 clamp(20px,3vw,32px);letter-spacing:-.015em;}
.emp-cart__grid{display:grid;grid-template-columns:1fr 340px;gap:clamp(24px,3vw,40px);align-items:start;}
@media(max-width:880px){.emp-cart__grid{grid-template-columns:1fr;}}
.emp-cart__items{border:1px solid var(--line);border-radius:4px;}
.emp-cart__row{display:flex;align-items:center;gap:16px;padding:18px 16px;border-bottom:1px solid var(--line);}
.emp-cart__row:last-child{border-bottom:0;}
.emp-cart__info{flex:1;min-width:0;}
.emp-cart__title{font-size:14px;font-weight:500;margin:0 0 2px;}
.emp-cart__vendor{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin:0 0 4px;}
.emp-cart__unit{font-size:13px;color:var(--muted);}
.emp-cart__line{width:96px;text-align:right;font-weight:700;color:var(--o);}
.emp-cart__rm{background:none;border:0;color:#bbb;font-size:15px;cursor:pointer;padding:6px;}
.emp-cart__rm:hover{color:var(--sale);}
.emp-cart__summary{border:1px solid var(--line);border-radius:4px;padding:22px;position:sticky;top:84px;}
.emp-cart__sumrow{display:flex;justify-content:space-between;font-size:14px;margin-bottom:12px;color:#333;}
.emp-cart__sumtotal{display:flex;justify-content:space-between;font-size:20px;font-weight:700;border-top:1px solid var(--line);padding-top:16px;margin-top:6px;}
.emp-cart__note{font-size:12px;color:var(--muted);margin:6px 0 18px;}
.emp-empty{text-align:center;padding:80px 20px;}
.emp-empty__i{font-size:52px;margin-bottom:16px;}
.emp-empty h1{border:0;}

/* Header / footer (tema) */
.emp-ann{background:#14201d;color:#fff;text-align:center;font-size:12.5px;padding:8px 16px;letter-spacing:.01em;}
.emp-hd{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:30;}
.emp-hd__row{max-width:1440px;margin:0 auto;padding:0 clamp(20px,3.5vw,56px);height:72px;display:flex;align-items:center;justify-content:space-between;gap:24px;}
.emp-hd__row img{display:block;}
/* Mega-nav (desktop hover dropdown — viamood.com.tr birebir) */
.emp-mm{display:flex;align-items:stretch;gap:clamp(4px,1vw,16px);}
.emp-mm__item{position:static;display:flex;align-items:stretch;}
.emp-mm__link{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-decoration:none;color:#1a1a1a;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.01em;white-space:nowrap;padding:6px 4px;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;}
.emp-mm__link svg{color:#222;transition:color .15s;}
.emp-mm__item:hover .emp-mm__link,.emp-mm__item:hover .emp-mm__link svg{color:var(--o);}
.emp-mm__item.has-mega:hover .emp-mm__link{border-color:var(--o);}
.emp-mm__panel{position:absolute;left:0;right:0;top:100%;z-index:50;background:#fff;border-top:1px solid #ececec;box-shadow:0 16px 40px rgba(0,0,0,.08);opacity:0;visibility:hidden;transform:translateY(-4px);pointer-events:none;transition:opacity .2s,transform .2s,visibility .2s;}
.emp-mm__item.has-mega:hover .emp-mm__panel,.emp-mm__panel:hover{opacity:1;visibility:visible;transform:translateY(0);pointer-events:auto;}
.emp-mm__inner{width:min(1440px,100%);margin-inline:auto;padding:28px clamp(20px,3.5vw,56px) 36px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;align-items:start;}
.emp-mm__col{background:#fafafa;border:1px solid #f0f0f0;border-radius:6px;padding:14px;}
.emp-mm__coltitle{font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#1a1a1a;text-align:center;line-height:1.3;margin:0 0 12px;padding-bottom:10px;border-bottom:2px solid var(--o);}
.emp-mm__collink{display:flex;align-items:center;gap:8px;padding:7px 6px;font-size:12.5px;color:#1a1a1a;text-decoration:none;line-height:1.2;border-bottom:1px solid #f0f0f0;transition:color .15s,background .15s,padding-left .15s;}
.emp-mm__collink:last-child{border-bottom:0;}
.emp-mm__collink:hover{color:var(--o);background:#fff8f6;padding-left:10px;}
.emp-mm__chev{width:14px;text-align:center;color:#c9c9c9;}
.emp-mm__lbl{flex:1;}
.emp-mm__arrow{margin-left:auto;opacity:0;transition:opacity .15s,transform .15s;}
.emp-mm__collink:hover .emp-mm__arrow{opacity:1;transform:translateX(2px);}

/* Mobil hamburger + drawer */
.emp-burger{display:none;order:-1;background:none;border:0;cursor:pointer;color:#1a1a1a;padding:4px;}
@media(max-width:980px){.emp-mm{display:none;}.emp-burger{display:inline-flex;}}
.emp-drawer{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.5);animation:empFade .2s;}
@keyframes empFade{from{opacity:0}to{opacity:1}}
.emp-drawer__panel{position:absolute;top:0;left:0;bottom:0;width:min(330px,85vw);background:#fff;display:flex;flex-direction:column;animation:empSlide .25s;}
@keyframes empSlide{from{transform:translateX(-100%)}to{transform:translateX(0)}}
.emp-drawer__head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line);font-weight:700;}
.emp-drawer__head button{background:none;border:0;font-size:18px;cursor:pointer;}
.emp-drawer__nav{flex:1;overflow-y:auto;padding:8px 0;}
.emp-drawer__row{display:flex;align-items:center;justify-content:space-between;width:100%;padding:13px 18px;background:none;border:0;font-size:15px;font-weight:500;text-align:left;cursor:pointer;color:#1a1a1a;text-decoration:none;}
.emp-drawer__row:hover{background:var(--alt);}
.emp-drawer__caret{transition:transform .2s;color:#999;font-size:18px;}
.emp-drawer__caret.on{transform:rotate(90deg);color:var(--o);}
.emp-drawer__sub{background:#fafafa;padding:6px 0 10px;}
.emp-drawer__subtitle{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#999;margin:8px 0 2px;padding:0 18px;}
.emp-drawer__sublink{display:block;padding:9px 18px 9px 30px;font-size:14px;color:#333;text-decoration:none;}
.emp-drawer__sublink:hover{color:var(--o);}
.emp-drawer__foot{display:flex;gap:16px;padding:16px 18px;border-top:1px solid var(--line);font-size:14px;}
.emp-drawer__foot a{color:#1a1a1a;text-decoration:none;font-weight:500;}

.emp-hd__nav{display:flex;align-items:flex-start;gap:clamp(6px,1.1vw,18px);}
.emp-hd__navitem{display:flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none;color:#1a1a1a;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.01em;white-space:nowrap;transition:color .15s;}
.emp-hd__navitem svg{color:#222;transition:color .15s;}
.emp-hd__navitem:hover,.emp-hd__navitem:hover svg{color:var(--o);}
@media(max-width:1080px){.emp-hd__navitem span{display:none;}}
.emp-hd__actions{display:flex;align-items:center;gap:16px;}
.emp-hd__icon{color:#1a1a1a;display:inline-flex;align-items:center;gap:6px;font-size:13px;text-decoration:none;font-weight:500;}
.emp-hd__icon:hover{color:var(--o);}
.emp-hd__cart{position:relative;}
@media(max-width:600px){.emp-hd__hide-sm{display:none;}}
.emp-hd__count{position:absolute;top:-7px;right:-9px;background:var(--o);color:#fff;font-size:10px;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;}
@media(max-width:920px){.emp-hd__nav{display:none;}}
.emp-ft{border-top:1px solid var(--line);background:#fff;margin-top:auto;}
.emp-ft__row{max-width:1440px;margin:0 auto;padding:28px clamp(20px,3.5vw,56px);display:flex;flex-wrap:wrap;gap:12px 32px;justify-content:space-between;align-items:center;font-size:13px;color:var(--muted);}
.emp-ft__links{display:flex;flex-wrap:wrap;gap:20px;}
.emp-ft__links a{color:var(--muted);text-decoration:none;}
.emp-ft__links a:hover{color:var(--o);}
`;
