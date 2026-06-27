/** Anasayfa section mimarisi (Shopify-tarzı düzenlenebilir bölümler).
 *  store_settings.theme.homeSections sıralı listeyi tutar; boşsa DEFAULT kullanılır.
 *  Editör (/admin/theme) bu listeyi sıralar/gizler/ayarlar. */

export type SectionType =
  | 'categories'
  | 'hero'
  | 'banners'
  | 'productSlider'
  | 'featureGrid'
  | 'productGrid'
  | 'trust'
  | 'story'
  | 'newsletter';

export type FieldType = 'text' | 'textarea' | 'image' | 'link' | 'number' | 'toggle' | 'repeater';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  // repeater için alt alanlar
  itemFields?: { key: string; label: string; type: FieldType }[];
  itemLabel?: string; // "Banner", "Kategori"
}

export interface HomeSection {
  id: string;
  type: SectionType;
  visible: boolean;
  settings: Record<string, unknown>;
}

export interface SectionDef {
  label: string;
  icon: string; // emoji
  fields: Field[];
}

const CDN = 'https://viamood.com.tr/cdn/shop/files';

/** Her section tipinin editör alan şeması. */
export const SECTION_DEFS: Record<SectionType, SectionDef> = {
  categories: {
    label: 'Kategoriler', icon: '🔵',
    fields: [
      { key: 'items', label: 'Kategori daireleri', type: 'repeater', itemLabel: 'Kategori', itemFields: [
        { key: 'label', label: 'Etiket', type: 'text' },
        { key: 'image', label: 'İkon görseli (URL)', type: 'image' },
        { key: 'url', label: 'Link', type: 'link' },
      ] },
    ],
  },
  hero: {
    label: 'Hero (üst banner)', icon: '🖼️',
    fields: [
      { key: 'image', label: 'Arkaplan görseli (URL)', type: 'image' },
      { key: 'title', label: 'Başlık', type: 'text' },
      { key: 'subtitle', label: 'Alt metin', type: 'textarea' },
      { key: 'cta1Text', label: '1. buton metni', type: 'text' },
      { key: 'cta1Link', label: '1. buton linki', type: 'link' },
      { key: 'cta2Text', label: '2. buton metni', type: 'text' },
      { key: 'cta2Link', label: '2. buton linki', type: 'link' },
    ],
  },
  banners: {
    label: 'Banner mozaiği (3)', icon: '🧩',
    fields: [
      { key: 'items', label: 'Bannerlar', type: 'repeater', itemLabel: 'Banner', itemFields: [
        { key: 'image', label: 'Görsel (URL)', type: 'image' },
        { key: 'title', label: 'Başlık', type: 'text' },
        { key: 'lead', label: 'Alt metin', type: 'text' },
        { key: 'btn', label: 'Buton metni', type: 'text' },
        { key: 'url', label: 'Link', type: 'link' },
      ] },
    ],
  },
  productSlider: {
    label: 'Ürün slider', icon: '🎚️',
    fields: [
      { key: 'title', label: 'Başlık', type: 'text' },
      { key: 'limit', label: 'Ürün sayısı', type: 'number' },
    ],
  },
  featureGrid: {
    label: 'Öne çıkan + ürünler', icon: '⭐',
    fields: [
      { key: 'featureLabel', label: 'Üst etiket', type: 'text' },
      { key: 'featureTitle', label: 'Başlık', type: 'text' },
      { key: 'featureLink', label: 'Link', type: 'link' },
    ],
  },
  productGrid: {
    label: 'Ürün ızgarası', icon: '🔲',
    fields: [
      { key: 'title', label: 'Başlık', type: 'text' },
      { key: 'limit', label: 'Ürün sayısı', type: 'number' },
    ],
  },
  trust: {
    label: 'Güven çubuğu', icon: '🛡️',
    fields: [
      { key: 'items', label: 'Maddeler', type: 'repeater', itemLabel: 'Madde', itemFields: [
        { key: 'label', label: 'Metin', type: 'text' },
      ] },
    ],
  },
  story: {
    label: 'Hikaye / About', icon: '📖',
    fields: [
      { key: 'image', label: 'Görsel (URL)', type: 'image' },
      { key: 'title', label: 'Başlık', type: 'text' },
      { key: 'lead', label: 'Metin', type: 'textarea' },
      { key: 'btnText', label: 'Buton metni', type: 'text' },
      { key: 'btnLink', label: 'Buton linki', type: 'link' },
    ],
  },
  newsletter: {
    label: 'Bülten', icon: '✉️',
    fields: [
      { key: 'title', label: 'Başlık', type: 'text' },
      { key: 'lead', label: 'Alt metin', type: 'text' },
    ],
  },
};

/** Varsayılan anasayfa config'i (mevcut birebir bölümler). store_settings boşsa bu kullanılır. */
export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  {
    id: 'categories', type: 'categories', visible: true,
    settings: { items: [
      { label: 'Çok Satanlar', image: `${CDN}/Cok_Satanlar.png?v=1781689607&width=400`, url: '/magaza' },
      { label: 'Mutfak', image: `${CDN}/Mutfak.png?v=1781689606&width=400`, url: '/magaza?cat=Mutfak' },
      { label: 'Hobi Ürünleri', image: `${CDN}/Hobi_Urunleri.png?v=1781689606&width=400`, url: '/magaza' },
      { label: '500 TL Altı', image: `${CDN}/500_TL_ALTI.png?v=1781689606&width=400`, url: '/magaza' },
      { label: 'İndirim', image: `${CDN}/INDIRIM.png?v=1781689607&width=400`, url: '/magaza' },
    ] },
  },
  {
    id: 'hero', type: 'hero', visible: true,
    settings: {
      image: `${CDN}/115_1-1.jpg?v=1778104256&width=2400`,
      title: 'Eviniz için, özenle seçilmiş ürünler',
      subtitle: 'Mutfaktan banyoya, dolap içinden tezgah üstüne — günlük rutini sade, düzenli ve estetik kılan ürünler.',
      cta1Text: 'Mağazaya git', cta1Link: '/magaza', cta2Text: 'Tüm ürünler', cta2Link: '/magaza',
    },
  },
  {
    id: 'banners', type: 'banners', visible: true,
    settings: { items: [
      { image: `${CDN}/ChatGPT_Image_17_Haz_2026_13_17_03.png?v=1781691478&width=1400`, title: 'Mutfağınız Daha Düzenli', lead: 'Günlük rutini kolaylaştıran pratik ürünler.', btn: 'Mağazaya git', url: '/magaza' },
      { image: `${CDN}/ChatGPT_Image_17_Haz_2026_13_09_37.png?v=1781691149&width=900`, title: 'Düzenli Bir Ev', lead: 'Her köşeye uygun şık ve işlevsel organizer çözümleri.', btn: 'Hepsini gör', url: '/magaza' },
      { image: `${CDN}/ChatGPT_Image_17_Haz_2026_13_22_33.png?v=1781691826&width=1400`, title: 'Çok Al, Az Öde!', lead: 'Kampanya setlerinde büyük tasarruf.', btn: 'İndirimleri gör', url: '/magaza' },
    ] },
  },
  { id: 'productSlider', type: 'productSlider', visible: true, settings: { title: 'En Tercih Edilenler', limit: 10 } },
  { id: 'featureGrid', type: 'featureGrid', visible: true, settings: { featureLabel: 'Sezon Sonu İndirimi', featureTitle: "%40'a varan indirim", featureLink: '/magaza' } },
  { id: 'productGrid', type: 'productGrid', visible: true, settings: { title: 'Yeni gelenler', limit: 8 } },
  {
    id: 'trust', type: 'trust', visible: true,
    settings: { items: [
      { label: 'Ücretsiz Kargo' }, { label: 'Kapıda Ödeme' }, { label: 'Güvenli Ödeme' }, { label: 'Sağlıklı Malzeme' }, { label: 'Yerli Üretim' },
    ] },
  },
  {
    id: 'story', type: 'story', visible: true,
    settings: {
      image: 'https://images.unsplash.com/photo-1556909114-44e3e9399a2a?w=1200&q=80&auto=format&fit=crop',
      title: 'Doğanın renkleriyle modern yaşam',
      lead: 'Via Mood, ev pratiğini sade ve estetik kılan ürünleri tek çatı altında topladı. Her ürün özenle seçildi.',
      btnText: 'Ürünleri keşfet', btnLink: '/magaza',
    },
  },
  { id: 'newsletter', type: 'newsletter', visible: true, settings: { title: 'Yeniliklerden ilk siz haberdar olun', lead: 'Mevsim koleksiyonları ve özel indirimler için kaydolun.' } },
];

/** store_settings.theme.homeSections geçerli mi (yoksa default). */
export function resolveHomeSections(raw: unknown): HomeSection[] {
  if (Array.isArray(raw) && raw.length) return raw as HomeSection[];
  return DEFAULT_HOME_SECTIONS;
}
