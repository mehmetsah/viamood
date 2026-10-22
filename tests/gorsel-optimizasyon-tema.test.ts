import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// #994886 (ŞAH, 22 Eki 2026) — Yunus m6 görsel optimizasyonu: küçük ≤55 KB, büyük ≤100 KB.
// Kök neden (canlı ölçüm): galeri src=3840 + Horizon varsayılan sizes ile 540 px görsele
// 1200-2560 px indiriliyordu; via-* bölümleri 900/1400 px sabit src, srcset yok; CDN kalitesi
// varsayılan (yüksek). Yama yalnız src/srcset/sizes/&quality= değiştirir, görünüm aynı.
// Bu çivi ONCESI hâlini KIRMIZI, SONRASI hâlini YEŞİL görmek zorunda (negatif kanıt içeride).

const DIZIN = join(__dirname, '..', 'tema-yamalari', '994886-gorsel');
const oku = (ad: string, hal: 'ONCESI' | 'SONRASI') => readFileSync(join(DIZIN, `${ad}.${hal}`), 'utf8');

const DOSYALAR = [
  'snippets__product-media.liquid',
  'snippets__product-media-gallery-content.liquid',
  'snippets__card-gallery.liquid',
  'sections__via-benzer-kategori.liquid',
  'sections__via-koleksiyon-v2.liquid',
  'sections__via-mood-home-v2.liquid',
] as const;

/** Bir tema dosyasındaki görsel sunum ihlallerini döndürür (boş = temiz). */
export function gorselIhlalleri(ad: string, icerik: string): string[] {
  const ihlal: string[] = [];
  // Ölçülmüş tuzak: image_tag, append ile değiştirilmiş adresi reddeder
  // ("input to image_tag must be an image_url" — önizlemede 90 hata üretti).
  if (/\|\s*append:[^}]*?\|\s*image_tag/s.test(icerik)) ihlal.push('append → image_tag zinciri');

  if (ad === 'snippets__product-media.liquid') {
    if (!icerik.includes('| image_url: width: src_genislik')) ihlal.push('galeri src hâlâ sabit 3840');
    if (!icerik.includes('assign high_res_url = media.preview_image | image_url: width: 3840')) ihlal.push('zoom yüksek çözünürlüğü bozulmuş');
    if (!icerik.includes("replace: '&amp;width=', kalite_amp")) ihlal.push('kalite ekleme yok');
  }
  if (ad === 'snippets__product-media-gallery-content.liquid') {
    const n = icerik.split("widths: '360, 540, 720, 1080', kalite: 75").length - 1;
    if (n !== 4) ihlal.push(`galeri widths/kalite ${n}/4`);
    if (icerik.includes('sizes: media_sizes, is_main_product_media')) ihlal.push('galeri Horizon varsayılan sizes kullanıyor');
    if (!/render 'product-media',\s*media: media,\s*sizes: '100vw'/.test(icerik)) ihlal.push('zoom diyaloğu render çağrısı kaybolmuş');
  }
  if (ad === 'snippets__card-gallery.liquid' && !icerik.includes("widths: '240, 360, 540', kalite: 65")) ihlal.push('kart galerisi sınırsız');

  if (ad.startsWith('sections__')) {
    const imgler = icerik.match(/<img\b[^>]*>/g) ?? [];
    for (const t of imgler) {
      const m = t.match(/src="\{\{[^}]*image_url: width: (\d+)/);
      if (!m) continue;
      const w = Number(m[1]);
      const urun = /featured_image \| image_url/.test(t);
      if (urun && w >= 500 && !t.includes('srcset=')) ihlal.push(`srcset'siz ${w}px ürün görseli: ${t.slice(0, 70)}`);
      if (urun && !t.includes('quality=')) ihlal.push(`kalitesiz ürün görseli: ${t.slice(0, 70)}`);
    }
    // Ana sayfada ölçülen büyük bloklar (hikâye 1400, kategori 1200, vitrin 1400) srcset'e geçmiş olmalı.
    // ⚠ Kapsam dışı (ölçülen sayfalarda render edilmiyor): koleksiyon hero, ilham kartı, kampanya bandı.
    if (ad === 'sections__via-mood-home-v2.liquid') {
      if (icerik.includes('<img src="{{ block.settings.gorsel | image_url: width: 1400 }}"')) ihlal.push('hikâye görseli 1400 sabit');
      if (icerik.includes('<img src="{{ block.settings.gorsel | image_url: width: 1200 }}" alt="{{ block.settings.baslik')) ihlal.push('kategori görseli 1200 sabit');
      if (icerik.includes('<img src="{{ v_img }}" alt="{{ v_baslik | escape }}" loading="lazy">{%- endif -%}') && !icerik.includes("v_img contains '/cdn/shop/'")) ihlal.push('vitrin görseli 1400 sabit');
    }
  }
  return ihlal;
}

describe('#994886 görsel optimizasyonu — tema bekçisi', () => {
  for (const ad of DOSYALAR) {
    it(`${ad}: SONRASI temiz`, () => {
      expect(gorselIhlalleri(ad, oku(ad, 'SONRASI'))).toEqual([]);
    });
    it(`${ad}: ONCESI kırmızı (negatif kanıt — bekçi gerçekten ölçüyor)`, () => {
      expect(gorselIhlalleri(ad, oku(ad, 'ONCESI')).length).toBeGreaterThan(0);
    });
  }

  it('append→image_tag tuzağı yakalanır (önizlemede ölçülen hata sınıfı)', () => {
    const tuzak = "{{ media.preview_image | image_url: width: 1080 | append: '&quality=75' | image_tag: widths: widths }}";
    expect(gorselIhlalleri('snippets__product-media.liquid', tuzak)).toContain('append → image_tag zinciri');
  });

  it('yama yalnız görsel adresine dokunur: img dışı satırlar aynen korunur', () => {
    for (const ad of DOSYALAR) {
      const temizle = (s: string) => s.split('\n').filter((l) => !/image_url|image_tag|<img|srcset|src_genislik|kalite|pm_gorsel|endcapture|#994886|\{%-? (else|endif) -?%\}|v_img contains|widths: '|sizes: '|render 'product-media'|^\s*(\{\{|\}\})\s*$/.test(l)).join('\n');
      expect(temizle(oku(ad, 'SONRASI'))).toBe(temizle(oku(ad, 'ONCESI')));
    }
  });
});
