# #995986 · ayse:863 KALEM 1 — «24 saat içinde kargoda» barı BASILMAZ (Yunus 6 Kas 08:05: «Sayaç olduğu için … bar'ını kaldıralım»).
# Bar, templates/product.json › product-details › vm_rozetler grubunun 2. rozeti (vm_rozet_2: ikon + metin).
# Yama: blok "disabled": true — Shopify devre dışı bloğu HİÇ render etmez (CSS ile gizleme değil); blok ayarı
# şablonda durur, geri alma tek satır. Sayaç (via_kargo_sayaci) ve öteki üç rozet DOKUNULMAZ.
# product.cok-al.json'da bu bar YOK (ölçüldü) — dokunulmadı.
import json
K = 'templates/product.json'
SIRA = [K]
ESKI = '                "vm_rozet_2": {\n                  "type": "group",\n'
YENI = '                "vm_rozet_2": {\n                  "type": "group",\n                  "disabled": true,\n'
YOL = ('sections', 'main', 'blocks', 'product-details', 'blocks', 'vm_rozetler', 'blocks', 'vm_rozet_2', 'disabled')
def ayristir(s): return json.loads(s[s.index('{'):])
def farklar(a, b, yol=()):
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b)): out += farklar(a.get(k, '∅'), b.get(k, '∅'), yol + (k,))
        return out
    return [] if a == b else [yol]
def uygula(k, v):
    if k != K: raise SystemExit('bilinmeyen dosya ' + k)
    if YENI in v: raise SystemExit(f'DUR {k}: zaten uygulanmış (vm_rozet_2 disabled)')
    n = v.count(ESKI)
    if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi)')
    s = v.replace(ESKI, YENI)
    f = farklar(ayristir(v), ayristir(s))
    if f != [YOL]: raise SystemExit(f'DUR {k}: beklenmeyen JSON farkı {f}')
    return s
if __name__ == '__main__':
    import os, hashlib
    B = os.path.dirname(os.path.abspath(__file__)); m = lambda x: hashlib.md5(x.encode()).hexdigest(); md = {}
    os.makedirs(f'{B}/SONRASI', exist_ok=True)
    for k in SIRA:
        f = k.replace('/', '__'); o = open(f'{B}/ONCESI/{f}', encoding='utf-8').read(); s = uygula(k, o)
        open(f'{B}/SONRASI/{f}', 'w', encoding='utf-8').write(s); md[k] = {'once': m(o), 'sonra': m(s)}; print(k, m(o), '->', m(s))
    json.dump(md, open(f'{B}/md5.json', 'w'), ensure_ascii=False, indent=1)
