# #994886 ŞAH — tema yama tanımı (eski -> yeni, beklenen eşleşme sayısı). Görünüm DEĞİŞMEZ: yalnız src/srcset/sizes/kalite.
Q = "&quality=75"   # büyük görseller
QK = "&quality=65"  # kartlar / küçük görseller (60 ürün örneği: 540px q65 → 59/60 ≤55 KB)
def kart(ifade, sizes, maks=540):
    ws = [w for w in (240, 360, 540, 720) if w <= maks]
    ss = ", ".join("{{ %s | image_url: width: %d }}%s %dw" % (ifade, w, QK, w) for w in ws)
    return 'src="{{ %s | image_url: width: 360 }}%s" srcset="%s" sizes="%s"' % (ifade, QK, ss, sizes)
GALERI_SIZES = "(min-width: 1044px) 540px, (min-width: 750px) calc(100vw - 480px), calc(100vw - 48px)"
SPEC = {
 "snippets/product-media.liquid": [
  ("  assign widths = widths | default: '240, 352, 832, 1200, 1600, 1920, 2560, 3840'\n",
   "  assign widths = widths | default: '240, 352, 832, 1200, 1600, 1920, 2560, 3840'\n"
   "  # #994886 ŞAH: src genisligi widths listesinin en buyugu; kalite verilirse CDN adresine quality eklenir\n"
   "  assign src_genislik = widths | split: ',' | last | strip | plus: 0\n"
   "  assign kalite_amp = '&amp;quality=' | append: kalite | append: '&amp;width='\n"
   "  assign kalite_geri = kalite_amp | append: '3840'\n", 1),
  ("  {{\n    media.preview_image\n    | image_url: width: 3840\n    | image_tag:\n      widths: widths,\n      alt: media.alt,\n      sizes: sizes,\n      loading: loading,\n      class: 'product-media__image',\n      ref: ref_image_to_transition,\n      data_max_resolution: high_res_url,\n      fetchpriority: fetch_priority,\n      style: focal_point_style,\n      ref: image_ref\n  }}\n",
   "  {% capture pm_gorsel %}{{\n    media.preview_image\n    | image_url: width: src_genislik\n    | image_tag:\n      widths: widths,\n      alt: media.alt,\n      sizes: sizes,\n      loading: loading,\n      class: 'product-media__image',\n      ref: ref_image_to_transition,\n      data_max_resolution: high_res_url,\n      fetchpriority: fetch_priority,\n      style: focal_point_style,\n      ref: image_ref\n  }}{% endcapture %}\n  {%- if kalite != blank -%}\n    {{ pm_gorsel | replace: '&amp;width=', kalite_amp | replace: kalite_geri, '&amp;width=3840' }}\n  {%- else -%}\n    {{ pm_gorsel }}\n  {%- endif -%}\n", 1),
 ],
 "snippets/product-media-gallery-content.liquid": [
  ("{%- render 'product-media', media: media, sizes: media_sizes, is_main_product_media: forloop.first -%}",
   "{%- render 'product-media', media: media, sizes: '" + GALERI_SIZES + "', widths: '360, 540, 720, 1080', kalite: 75, is_main_product_media: forloop.first -%}", 4),
  ("                      | image_url: width: 1024\n", "                      | image_url: width: 240\n", 1),
 ],
 "snippets/card-gallery.liquid": [
  ("render 'product-media', media: media, sizes: sizes, loading: loading, preview_image_only: true",
   "render 'product-media', media: media, sizes: sizes, loading: loading, preview_image_only: true, widths: '240, 360, 540', kalite: 65", 1),
 ],
 "sections/via-benzer-kategori.liquid": [
  ('<img src="{{ p.featured_image | image_url: width: 500 }}" alt="{{ p.title | escape }}" loading="lazy" width="500" height="500">',
   '<img ' + kart("p.featured_image", "(min-width: 750px) 300px, 42vw") + ' alt="{{ p.title | escape }}" loading="lazy" width="500" height="500">', 1),
 ],
 "sections/via-koleksiyon-v2.liquid": [
  ('<img src="{{ p.featured_image | image_url: width: 900 }}" alt="{{ p.title | escape }}" loading="lazy">',
   '<img ' + kart("p.featured_image", "(min-width: 750px) 360px, 42vw") + ' alt="{{ p.title | escape }}" loading="lazy">', 1),
 ],
 "sections/via-mood-home-v2.liquid": [
  ('<img src="{{ p.featured_image | image_url: width: 900 }}" alt="{{ p.title | escape }}" loading="lazy">',
   '<img ' + kart("p.featured_image", "(min-width: 750px) 320px, 40vw") + ' alt="{{ p.title | escape }}" loading="lazy">', -1),
  ('<img src="{{ block.settings.gorsel | image_url: width: 1400 }}" alt="{{ block.settings.baslik | escape }}" loading="lazy">',
   '<img src="{{ block.settings.gorsel | image_url: width: 720 }}' + Q + '" srcset="{{ block.settings.gorsel | image_url: width: 540 }}' + Q + ' 540w, {{ block.settings.gorsel | image_url: width: 720 }}' + Q + ' 720w, {{ block.settings.gorsel | image_url: width: 1080 }}' + Q + ' 1080w" sizes="(min-width: 750px) 700px, 90vw" alt="{{ block.settings.baslik | escape }}" loading="lazy">', 1),
  ('<img src="{{ block.settings.gorsel | image_url: width: 1200 }}" alt="{{ block.settings.baslik | escape }}" loading="lazy">',
   '<img src="{{ block.settings.gorsel | image_url: width: 720 }}' + Q + '" srcset="{{ block.settings.gorsel | image_url: width: 360 }}' + Q + ' 360w, {{ block.settings.gorsel | image_url: width: 540 }}' + Q + ' 540w, {{ block.settings.gorsel | image_url: width: 720 }}' + Q + ' 720w, {{ block.settings.gorsel | image_url: width: 1080 }}' + Q + ' 1080w" sizes="(min-width: 750px) 56vw, 45vw" alt="{{ block.settings.baslik | escape }}" loading="lazy">', 1),
  ('{%- if v_img != blank -%}<img src="{{ v_img }}" alt="{{ v_baslik | escape }}" loading="lazy">{%- endif -%}',
   "{%- if v_img != blank -%}{%- if v_img contains '/cdn/shop/' and v_img contains 'width=1400' -%}"
   "<img src=\"{{ v_img | replace: 'width=1400', 'width=720' }}" + Q + "\" srcset=\"{{ v_img | replace: 'width=1400', 'width=540' }}" + Q + " 540w, {{ v_img | replace: 'width=1400', 'width=720' }}" + Q + " 720w, {{ v_img | replace: 'width=1400', 'width=1080' }}" + Q + " 1080w\" sizes=\"(min-width: 750px) 740px, 90vw\" alt=\"{{ v_baslik | escape }}\" loading=\"lazy\">"
   "{%- else -%}<img src=\"{{ v_img }}\" alt=\"{{ v_baslik | escape }}\" loading=\"lazy\">{%- endif -%}{%- endif -%}", 1),
  ('<span class="vu-img">{%- if p.featured_image -%}<img src="{{ p.featured_image | image_url: width: 400 }}" alt="{{ p.title | escape }}" loading="lazy">',
   '<span class="vu-img">{%- if p.featured_image -%}<img src="{{ p.featured_image | image_url: width: 360 }}' + QK + '" alt="{{ p.title | escape }}" loading="lazy">', 1),
 ],
}
