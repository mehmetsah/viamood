# #995388 — kategori kartı görsel kutusu arama kartıyla eşitlenir: 3/4 → 2/3. Tek çapa, count==1.
ESKI = '.vkol2-media{aspect-ratio:3/4;position:relative;overflow:hidden;background:#eee9e2;display:block}'
YENI = '.vkol2-media{aspect-ratio:2/3;position:relative;overflow:hidden;background:#eee9e2;display:block} /* #995388: arama kartıyla aynı oran (2/3) — 2:3 ürün görselleri üstten/alttan kesilmesin */'
K = 'sections/via-koleksiyon-v2.liquid'
def uygula(k, v):
    if k != K: raise SystemExit('bilinmeyen dosya ' + k)
    n = v.count(ESKI)
    if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi)')
    return v.replace(ESKI, YENI)
if __name__ == '__main__':
    import os, hashlib, json
    B = os.path.dirname(os.path.abspath(__file__)); f = K.replace('/', '__')
    o = open(f'{B}/ONCESI/{f}', encoding='utf-8').read(); s = uygula(K, o)
    os.makedirs(f'{B}/SONRASI', exist_ok=True); open(f'{B}/SONRASI/{f}', 'w', encoding='utf-8').write(s)
    m = lambda x: hashlib.md5(x.encode()).hexdigest()
    json.dump({'once': m(o), 'sonra': m(s)}, open(f'{B}/md5.json', 'w')); print(m(o), '->', m(s))
