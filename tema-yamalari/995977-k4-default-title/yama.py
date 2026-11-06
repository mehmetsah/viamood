# #995977 kalem 4 — «Default Title · Default Title» tekrarı (sahip kararı 6 Kas 09:36 «Hepsi sırayla»).
# Ölçülen kök (Admin + canlı):
#   - Vitrindeki 100 tek varyantlı ürünün seçenek ADI «Title» değil «Default Title» kaydedilmiş.
#   - Shopify bu yüzden has_only_default_variant = false döndürüyor; varyant seçici basılıyor.
#   - Seçici, etiket «Default Title» + değer «Default Title» basıyor.
#   - 374 ürün doğru kayıtlı («Title»); onlarda seçici zaten basılmıyor.
# Yama: snippets/variant-main-picker.liquid satır 12 — tek varyantlı ürün de seçiciyi BASMAZ.
#   - Gizlemek değil, basmamak: aynı `unless` bloğu, koşula `variants.size == 1` eklendi.
#   - Çok varyantlı ürünlerde koşul değişmiyor.
#   - Ürün verisine dokunulmadı.
K = 'snippets/variant-main-picker.liquid'
ESKI = '{% unless product_resource.has_only_default_variant %}\n'
YENI = ('{%- comment -%} #995977: tek varyantlı ürün seçiciyi basmaz. 100 ürünün seçenek adı «Default Title» kayıtlı;\n'
        '  has_only_default_variant onlarda false dönüyor ve «Default Title · Default Title» basılıyordu. {%- endcomment -%}\n'
        '{% unless product_resource.has_only_default_variant or product_resource.variants.size == 1 %}\n')
def uygula(k, v):
    if k != K: raise SystemExit('bilinmeyen dosya ' + k)
    n = v.count(ESKI)
    if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi)')
    s = v.replace(ESKI, YENI)
    if s.count('{% unless') != v.count('{% unless') or s.count('{% endunless %}') != v.count('{% endunless %}'):
        raise SystemExit(f'DUR {k}: unless/endunless dengesi değişti')
    return s
if __name__ == '__main__':
    import os, hashlib, json
    B = os.path.dirname(os.path.abspath(__file__)); f = K.replace('/', '__')
    o = open(f'{B}/ONCESI/{f}', encoding='utf-8').read(); s = uygula(K, o)
    os.makedirs(f'{B}/SONRASI', exist_ok=True); open(f'{B}/SONRASI/{f}', 'w', encoding='utf-8').write(s)
    m = lambda x: hashlib.md5(x.encode()).hexdigest()
    json.dump({'once': m(o), 'sonra': m(s)}, open(f'{B}/md5.json', 'w')); print(m(o), '->', m(s))
