# #995332 · ayse:802 — yama tanımı. Her çapa count==1 olmalı (değilse DUR). Yerel ve sunucuda AYNI fonksiyon.
import os
B = os.path.dirname(os.path.abspath(__file__))
CAPA_LAYOUT = "    <link rel=\"stylesheet\" href=\"{{ 'via-mobile-app.css' | asset_url }}\">\n"
EK_LAYOUT = "    <script src=\"{{ 'via-kart-gorsel.js' | asset_url }}\" defer></script>\n"
EK_CSS = open(os.path.join(B, 'ek-blok.css'), encoding='utf-8').read()
ISARET = '#995332 · ayse:802'

def uygula(k, v):
    if k == 'layout/theme.liquid':
        n = v.count(CAPA_LAYOUT)
        if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi)')
        if 'via-kart-gorsel.js' in v: raise SystemExit(f'DUR {k}: script zaten var')
        return v.replace(CAPA_LAYOUT, CAPA_LAYOUT + EK_LAYOUT)
    if k == 'assets/via-product-overrides.css':
        if v.count(ISARET) != 0: raise SystemExit(f'DUR {k}: işaret zaten var')
        return v + EK_CSS
    raise SystemExit('bilinmeyen dosya ' + k)

if __name__ == '__main__':
    import hashlib, json
    md5 = lambda s: hashlib.md5(s.encode()).hexdigest()
    M = {}
    os.makedirs(os.path.join(B, 'SONRASI'), exist_ok=True)
    for k in ['layout/theme.liquid', 'assets/via-product-overrides.css']:
        f = k.replace('/', '__'); o = open(os.path.join(B, 'ONCESI', f), encoding='utf-8').read(); s = uygula(k, o)
        open(os.path.join(B, 'SONRASI', f), 'w', encoding='utf-8').write(s); M[k] = {'once': md5(o), 'sonra': md5(s)}
    j = open(os.path.join(B, 'YENI', 'assets__via-kart-gorsel.js'), encoding='utf-8').read(); M['assets/via-kart-gorsel.js'] = {'once': None, 'sonra': md5(j)}
    json.dump(M, open(os.path.join(B, 'md5.json'), 'w'), indent=1); print(json.dumps(M, indent=1))
