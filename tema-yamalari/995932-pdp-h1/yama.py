# #995932 — PDP başlığı (h1) computed 43.584px → 18px (Yunus, 5 Kas 2026; kabul bandı 16-20px).
# Kök: templates/product.json › product-details › text_GnyQiN bloğu `type_preset: "h2"` taşıyor. h2 ön ayarı tema
# ölçeğinde akışkan: --font-size--h2 = clamp(2.25rem, 4.8vw, 3.0rem) → 908px pencerede 0.048 × 908 = 43.584px,
# ≥1000px'te 48px. Ürün başlığı dar sütunda (336px) bu yüzden 8-9 satıra taşıyordu.
# Yama: aynı bloğun ön ayarı "h5" (--font-size--h5 = 1.125rem = 18px, sabit). Tek çapa (count==1), tek değer.
# Aile/kalınlık/harf aralığı empire-overrides.css'teki h1 !important kuralından, satır oranı (1.32)
# via-product-overrides.css'teki h1,h2,h3 !important kuralından geliyor; ön ayar değişince onlar AYNI kalır (ölçüldü).
# ≤749px'teki `.product-information h1, .product-details h1, .group-block h1 { font-size: 19px !important }` (via-mobile-app.css)
# bilinçli olarak dokunulmadı: `.group-block h1` ile başka yüzeylere de değiyor.
# Aynı h2 ön ayarı başka şablonlarda da var (product.cok-al.json başlığı, 404, article, page, page.contact, search) — dokunulmadı.
import json
K = 'templates/product.json'
ESKI = ('                "text": "<h1>{{ closest.product.title }}<\\/h1>",\n'
        '                "width": "100%",\n'
        '                "max_width": "normal",\n'
        '                "alignment": "left",\n'
        '                "type_preset": "h2",\n')
YENI = ESKI.replace('"type_preset": "h2"', '"type_preset": "h5"')
YOL = ('sections', 'main', 'blocks', 'product-details', 'blocks', 'text_GnyQiN', 'settings', 'type_preset')
def ayristir(s):
    i = s.index('{', s.index('*/')) if s.lstrip().startswith('/*') else 0
    return json.loads(s[i:])
def farklar(a, b, yol=()):
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            out += farklar(a.get(k, '∅'), b.get(k, '∅'), yol + (k,))
        return out
    return [] if a == b else [yol]
def uygula(k, v):
    if k != K: raise SystemExit('bilinmeyen dosya ' + k)
    n = v.count(ESKI)
    if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi)')
    s = v.replace(ESKI, YENI)
    f = farklar(ayristir(v), ayristir(s))
    if f != [YOL]: raise SystemExit(f'DUR {k}: beklenmeyen JSON farkı {f}')
    return s
if __name__ == '__main__':
    import os, hashlib
    B = os.path.dirname(os.path.abspath(__file__)); f = K.replace('/', '__')
    o = open(f'{B}/ONCESI/{f}', encoding='utf-8').read(); s = uygula(K, o)
    os.makedirs(f'{B}/SONRASI', exist_ok=True); open(f'{B}/SONRASI/{f}', 'w', encoding='utf-8').write(s)
    m = lambda x: hashlib.md5(x.encode()).hexdigest()
    json.dump({'once': m(o), 'sonra': m(s)}, open(f'{B}/md5.json', 'w')); print(m(o), '->', m(s))
