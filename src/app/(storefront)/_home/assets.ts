/** viamood.com.tr canlı temasından BİREBİR çıkarılan asset'ler (Shopify CDN + tema SVG ikonları).
 *  Kaynak: workflow extract-viamood-theme-assets (canlı HTML grep ile doğrulandı). */

const CDN = 'https://viamood.com.tr/cdn/shop/files';

export const HERO_IMAGE = `${CDN}/115_1-1.jpg?v=1778104256&width=2400`;

export interface HomeCat {
  label: string;
  image: string;
  url: string;
}
export const HOME_CATEGORIES: HomeCat[] = [
  { label: 'Çok Satanlar', image: `${CDN}/Cok_Satanlar.png?v=1781689607&width=400`, url: '/magaza' },
  { label: 'Mutfak', image: `${CDN}/Mutfak.png?v=1781689606&width=400`, url: '/magaza?cat=Mutfak' },
  { label: 'Hobi Ürünleri', image: `${CDN}/Hobi_Urunleri.png?v=1781689606&width=400`, url: '/magaza' },
  { label: '500 TL Altı', image: `${CDN}/500_TL_ALTI.png?v=1781689606&width=400`, url: '/magaza' },
  { label: 'İndirim', image: `${CDN}/INDIRIM.png?v=1781689607&width=400`, url: '/magaza' },
];

export interface HomeBanner {
  cls: string;
  image: string;
  title: string;
  lead: string;
  btn: string;
  url: string;
}
export const HOME_BANNERS: HomeBanner[] = [
  { cls: 'emp-bnr--xl', image: `${CDN}/ChatGPT_Image_17_Haz_2026_13_17_03.png?v=1781691478&width=1400`, title: 'Mutfağınız Daha Düzenli', lead: 'Günlük rutini kolaylaştıran pratik ürünler.', btn: 'Mağazaya git', url: '/magaza' },
  { cls: '', image: `${CDN}/ChatGPT_Image_17_Haz_2026_13_09_37.png?v=1781691149&width=900`, title: 'Düzenli Bir Ev', lead: 'Her köşeye uygun şık ve işlevsel organizer çözümleri.', btn: 'Hepsini gör', url: '/magaza' },
  { cls: 'emp-bnr--wide', image: `${CDN}/ChatGPT_Image_17_Haz_2026_13_22_33.png?v=1781691826&width=1400`, title: 'Çok Al, Az Öde!', lead: 'Kampanya setlerinde büyük tasarruf.', btn: 'İndirimleri gör', url: '/magaza' },
];

export interface MegaCol {
  heading: string;
  links: { label: string; url: string }[];
}
export interface NavItem {
  label: string;
  url: string;
  icon: string; // SVG iç path'leri
  mega?: MegaCol[]; // hover dropdown sütunları (viamood.com.tr mega-menü birebir)
}
/** Header mega-nav — 8 öğe, tema SVG ikonları (icon üstte, label altta). Linkler native katalog'a. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Yeni Gelenler', url: '/magaza', icon: '<path d="M3 12l9-8 9 8M5 10v10h14V10"/>' },
  { label: 'Çok Satanlar', url: '/magaza', icon: '<path d="M12 3c.5 3 3 4 3 7a3 3 0 0 1-6 0c0-2 1-3 3-7zM6 14c0 3.3 2.7 7 6 7s6-3.7 6-7c0-2-2-3-4-6"/>' },
  {
    label: 'Ev ve Yaşam', url: '/magaza', icon: '<path d="M3 7l9-4 9 4v10l-9 4-9-4V7z M3 7l9 4 9-4 M12 11v10"/>',
    mega: [
      { heading: 'Saklama & Düzen', links: [{ label: 'Tüm Saklama & Düzen', url: '/magaza' }] },
      { heading: 'Mutfak', links: [{ label: 'Tüm Mutfak', url: '/magaza?cat=Mutfak' }] },
      { heading: 'Gıda & Sofra', links: [{ label: 'Gıda', url: '/magaza' }, { label: 'Sofra & Servis', url: '/magaza' }] },
      { heading: 'Banyo & Çamaşır', links: [{ label: 'Banyo', url: '/magaza' }, { label: 'Çamaşır', url: '/magaza' }] },
      { heading: 'Temizlik & Tekstil', links: [{ label: 'Temizlik', url: '/magaza' }, { label: 'Ev Tekstili', url: '/magaza' }] },
    ],
  },
  {
    label: 'Hobi', url: '/magaza', icon: '<path d="M3 7h18l-2 13H5L3 7z M8 7V4a4 4 0 0 1 8 0v3"/>',
    mega: [
      { heading: 'Hobi', links: [{ label: 'Hırdavat & Takım', url: '/magaza' }, { label: 'Bahçe & Saksı', url: '/magaza' }] },
      { heading: 'Saklama Kutuları & Organizer', links: [{ label: 'Saklama & Düzen', url: '/magaza' }] },
    ],
  },
  {
    label: 'Çocuk', url: '/magaza', icon: '<circle cx="12" cy="5" r="3"/><path d="M7 21v-5l-2-3 7-2 7 2-2 3v5"/>',
    mega: [{ heading: 'Çocuk', links: [{ label: 'Oyuncak', url: '/magaza' }] }],
  },
  {
    label: 'Kampanya Setleri', url: '/magaza', icon: '<path d="M20 12v9H4v-9 M2 7h20v5H2z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    mega: [{ heading: 'Kampanya Setleri', links: [{ label: 'Tüm Kampanya Setleri', url: '/magaza' }] }],
  },
  { label: 'Kurumsal', url: '/magaza', icon: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-5h6v5 M8 7h0M12 7h0M16 7h0M8 11h0M12 11h0M16 11h0"/>' },
  { label: 'Blog', url: '/magaza', icon: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z M14 3v6h6 M8 14h8 M8 18h6"/>' },
];
