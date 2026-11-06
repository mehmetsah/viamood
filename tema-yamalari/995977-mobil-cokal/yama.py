# #995977 · ayse:858 iki ayak (ŞAH bulgusu, Ayşe teyidi; 6 Kas 2026).
# AYAK 1 — mobil boş ilk ekran. Ölçülen kök (canlı, 390px, ürün 132):
#   assets/via-mobile-app.css @media (max-width: 749px) «ÜRÜN DETAY» kuralı
#   `.product-information, .product-page, [class*="product-information"] { padding-bottom: 112px !important }`.
#   [class*=…] bölümün kendisinde kalmıyor, .product-information__grid ve .product-information__media'ya da 112px veriyor.
#   390'da galeri altı (632) → başlık (792) arası 160px; medya kolonu 696 (galeri 568 + 16 + 112).
#   Ana sayfa, koleksiyon ve sepette seçici 0 öğe yakalıyor (ölçüldü); yalnız PDP ızgarası ve medya kolonu.
#   Yama: [class*=…] listeden çıkar. Bölüm (.product-information) ve .product-page 112px'ini korur.
# AYAK 2 — templates/product.cok-al.json › main.settings.equal_columns false → true
#   (ayse:858 hükmü; varsayılan şablonda #995939 ile uygulanmıştı). CSS tarafı zaten --half ızgaraya bağlı.
import json
CSS = 'assets/via-mobile-app.css'
TPL = 'templates/product.cok-al.json'
CSS_ESKI = ('  /* === ÜRÜN DETAY (Shopify Horizon: product-media, dialog-thumbnails-list) === */\n'
            '  .product-information,\n'
            '  .product-page,\n'
            '  [class*="product-information"] {\n'
            '    padding-bottom: 112px !important; /* #994771 4px izgara: 110 idi */\n'
            '  }\n')
CSS_YENI = ('  /* === ÜRÜN DETAY (Shopify Horizon: product-media, dialog-thumbnails-list) === */\n'
            '  /* #995977 · ayse:858: `[class*="product-information"]` bu listeden çıktı. Alt boşluk\n'
            '     bölüme verilmek isteniyordu, ama sıçrayıp .product-information__grid ve\n'
            '     .product-information__media\'ya da 112px ekliyordu; 390px\'te galeri ile başlık\n'
            '     arasında 160px boşluk vardı. Bölümün kendi 112px\'i aynen duruyor. */\n'
            '  .product-information,\n'
            '  .product-page {\n'
            '    padding-bottom: 112px !important; /* #994771 4px izgara: 110 idi */\n'
            '  }\n')
TPL_ESKI = '        "equal_columns": false,\n'
TPL_YENI = '        "equal_columns": true,\n'
TPL_YOL = ('sections', 'main', 'settings', 'equal_columns')
K = [CSS, TPL]
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
    if k == CSS:
        n = v.count(CSS_ESKI)
        if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi)')
        s = v.replace(CSS_ESKI, CSS_YENI)
        if s.count('[class*="product-information"]') != 1: raise SystemExit(f'DUR {k}: sızıntı seçicisi hâlâ kural olarak duruyor')
        return s
    if k == TPL:
        n = v.count(TPL_ESKI)
        if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi)')
        s = v.replace(TPL_ESKI, TPL_YENI)
        f = farklar(ayristir(v), ayristir(s))
        if f != [TPL_YOL]: raise SystemExit(f'DUR {k}: beklenmeyen JSON farkı {f}')
        return s
    raise SystemExit('bilinmeyen dosya ' + k)
if __name__ == '__main__':
    import os, hashlib
    B = os.path.dirname(os.path.abspath(__file__)); m = lambda x: hashlib.md5(x.encode()).hexdigest(); md = {}
    os.makedirs(f'{B}/SONRASI', exist_ok=True)
    for k in K:
        f = k.replace('/', '__'); o = open(f'{B}/ONCESI/{f}', encoding='utf-8').read(); s = uygula(k, o)
        open(f'{B}/SONRASI/{f}', 'w', encoding='utf-8').write(s); md[k] = {'once': m(o), 'sonra': m(s)}; print(k, m(o), '->', m(s))
    json.dump(md, open(f'{B}/md5.json', 'w'), ensure_ascii=False, indent=1)
