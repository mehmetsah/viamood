# #995939 · ayse:858 — ViaMood ürün detay sayfası %50/%50 (Yunus, 5 Kas 2026 ekran görüntüsü; ürün 132).
# Ölçülen kök (canlı, 1280px): .product-information__grid «800px 400px» — tema ≥1200px'te equal_columns kapalıyken
# «2fr 1fr» kullanıyor. Üstüne via-product-overrides.css 1. satırdaki
# `.product-information__media,.product-media-gallery,media-gallery{max-width:540px!important;margin-inline:auto!important}`
# galeriyi 800px kolonda 540px'e kısıp 118 + 142px boş şerit bırakıyor.
# Yama (iki dosya, her çapa count==1, başka satıra dokunulmaz):
#   1) templates/product.json › main.settings.equal_columns false → true. Temanın KENDİ ayarı:
#      snippets/product-information-content.liquid:62 → .product-information__grid--half (1fr 1fr).
#   2) via-product-overrides.css: 540px tavanı YALNIZ yarım ızgarada (≥761px) kalkar. 1. satırdaki ortak kural
#      değişmez; yarım ızgara yalnız PDP'de var (featured-product-information hiçbir şablonda kullanılmıyor, ölçüldü).
# Tipografi, renk ve bileşen sırası değişmez (md.16). #995932 başlık ön ayarı (h5) bu dosyada aynen kalır.
import json
TPL = 'templates/product.json'
CSS = 'assets/via-product-overrides.css'
TPL_ESKI = '        "equal_columns": false,\n'
TPL_YENI = '        "equal_columns": true,\n'
TPL_YOL = ('sections', 'main', 'settings', 'equal_columns')
CSS_CAPA = ('@media screen and (min-width: 750px) {\n'
            '  .product-information > .product-information__grid {\n'
            '    grid-column: 2 !important;\n'
            '  }\n'
            '}\n')
CSS_EK = ('\n'
          '/* ─────────────────────────────────────────────────────────────────────────\n'
          '   #995939 · ayse:858 · ÜRÜN DETAY %50/%50 — Yunus 5 Kas ekran görüntüsü (ürün 132)\n'
          '   ÖLÇÜLEN KÖK SEBEP (Playwright, canlı, 1280px):\n'
          '     .product-information__grid  grid-template-columns: 800px 400px   ← tema «2fr 1fr»\n'
          '     media-gallery  max-width: 540px !important (bu dosya, 1. satır)  ← 118 + 142px boş şerit\n'
          '   Kolon oranı temanın KENDİ ayarıyla düzeldi: templates/product.json\n'
          '   equal_columns: true → .product-information__grid--half (600/600).\n'
          '   Burada yalnız 540px tavanı, yarım ızgarada kalkar; galeri kolonunu doldurur.\n'
          '   !important zorunlu: kalkan tavan da !important. Daha özgül seçici onu yalnız\n'
          '   --half ızgarada ezer; 1. satırdaki ortak kural öteki yüzeyler için aynen durur.\n'
          '   Yarım ızgara yalnız PDP\'de var (featured-product-information hiçbir şablonda\n'
          '   kullanılmıyor, ölçüldü). ≤760px kapsam dışı: orada zaten max-width: 100%.\n'
          '   ───────────────────────────────────────────────────────────────────────── */\n'
          '@media screen and (min-width: 761px) {\n'
          '  .product-information__grid--half .product-information__media,\n'
          '  .product-information__grid--half media-gallery {\n'
          '    max-width: none !important;\n'
          '  }\n'
          '}\n')
K = [TPL, CSS]
def ayristir(s):
    return json.loads(s[s.index('{'):])
def farklar(a, b, yol=()):
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            out += farklar(a.get(k, '∅'), b.get(k, '∅'), yol + (k,))
        return out
    return [] if a == b else [yol]
def uygula(k, v):
    if k == TPL:
        n = v.count(TPL_ESKI)
        if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi)')
        s = v.replace(TPL_ESKI, TPL_YENI)
        f = farklar(ayristir(v), ayristir(s))
        if f != [TPL_YOL]: raise SystemExit(f'DUR {k}: beklenmeyen JSON farkı {f}')
        return s
    if k == CSS:
        n = v.count(CSS_CAPA)
        if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi)')
        if '#995939' in v: raise SystemExit(f'DUR {k}: #995939 bloğu zaten var')
        return v.replace(CSS_CAPA, CSS_CAPA + CSS_EK)
    raise SystemExit('bilinmeyen dosya ' + k)
if __name__ == '__main__':
    import os, hashlib
    B = os.path.dirname(os.path.abspath(__file__)); m = lambda x: hashlib.md5(x.encode()).hexdigest(); md = {}
    os.makedirs(f'{B}/SONRASI', exist_ok=True)
    for k in K:
        f = k.replace('/', '__'); o = open(f'{B}/ONCESI/{f}', encoding='utf-8').read(); s = uygula(k, o)
        open(f'{B}/SONRASI/{f}', 'w', encoding='utf-8').write(s); md[k] = {'once': m(o), 'sonra': m(s)}; print(k, m(o), '->', m(s))
    json.dump(md, open(f'{B}/md5.json', 'w'), ensure_ascii=False, indent=1)
