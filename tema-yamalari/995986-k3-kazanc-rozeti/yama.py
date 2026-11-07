# #995986 · ayse:863 KALEM 3 — kazanç rozeti ürün adının ÜSTÜNDE (Yunus 6 Kas 08:05). Üç dosya:
#   YENİ blocks/via-kazanc.liquid (tutar = compare_at − price; indirim yoksa hiçbir şey basılmaz) +
#   templates/product.json ve templates/product.cok-al.json: product-details'e via_kazanc bloğu, block_order'da başlıktan ÖNCE.
# Şablon farkı YALNIZ iki JSON yolu: blocks.via_kazanc (yeni) + block_order (başa via_kazanc). Başka alan değişmez.
# Sıra: önce blok dosyası (şablon ona başvurur), sonra şablonlar. GERI blok dosyasını SİLMEZ (referansı kalkınca kullanılmaz).
import json
BLK = 'blocks/via-kazanc.liquid'
TPL = 'templates/product.json'
COK = 'templates/product.cok-al.json'
SIRA = [BLK, TPL, COK]
TANIM_CAPA = '            "text_GnyQiN": {\n'
TANIM_YENI = ('            "via_kazanc": {\n'
              '              "type": "via-kazanc",\n'
              '              "settings": {}\n'
              '            },\n' + TANIM_CAPA)
SIRA_CAPA = '            "text_GnyQiN",\n'
SIRA_YENI = '            "via_kazanc",\n' + SIRA_CAPA
PD = ('sections', 'main', 'blocks', 'product-details')
def ayristir(s): return json.loads(s[s.index('{'):])
def farklar(a, b, yol=()):
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b)): out += farklar(a.get(k, '∅'), b.get(k, '∅'), yol + (k,))
        return out
    return [] if a == b else [yol]
def al(o, yol):
    for k in yol: o = o[k]
    return o
def uygula(k, v):
    if k not in (TPL, COK): raise SystemExit('yama yalnız şablonlara: ' + k)
    for capa, yeni in ((TANIM_CAPA, TANIM_YENI), (SIRA_CAPA, SIRA_YENI)):
        n = v.count(capa)
        if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi): {capa!r}')
    if '"via_kazanc"' in v: raise SystemExit(f'DUR {k}: via_kazanc zaten var')
    s = v.replace(TANIM_CAPA, TANIM_YENI).replace(SIRA_CAPA, SIRA_YENI)
    o, y = ayristir(v), ayristir(s)
    f = farklar(o, y)
    if f != [PD + ('block_order',), PD + ('blocks', 'via_kazanc')]: raise SystemExit(f'DUR {k}: beklenmeyen JSON farkı {f}')
    if al(y, PD + ('block_order',)) != ['via_kazanc'] + al(o, PD + ('block_order',)): raise SystemExit(f'DUR {k}: block_order başa eklenmedi')
    if al(y, PD + ('blocks', 'via_kazanc')) != {'type': 'via-kazanc', 'settings': {}}: raise SystemExit(f'DUR {k}: via_kazanc tanımı beklenenden farklı')
    return s
if __name__ == '__main__':
    import os, hashlib
    B = os.path.dirname(os.path.abspath(__file__)); m = lambda x: hashlib.md5(x.encode()).hexdigest(); md = {}
    os.makedirs(f'{B}/SONRASI', exist_ok=True)
    for k in SIRA:
        f = k.replace('/', '__')
        if k == BLK:
            s = open(f'{B}/YENI/{f}', encoding='utf-8').read(); md[k] = {'once': None, 'sonra': m(s)}; print(k, 'YENİ ->', m(s)); continue
        o = open(f'{B}/ONCESI/{f}', encoding='utf-8').read(); s = uygula(k, o)
        open(f'{B}/SONRASI/{f}', 'w', encoding='utf-8').write(s); md[k] = {'once': m(o), 'sonra': m(s)}; print(k, m(o), '->', m(s))
    json.dump(md, open(f'{B}/md5.json', 'w'), ensure_ascii=False, indent=1)
