# #995977 sunucu basımı (iki dosya): HER dosya için canlı GET → md5 == ÖNCESİ → yama → md5 == SONRASI (önce HEPSİ, sonra yazım)
# → PUT → GET-back; herhangi bir hata → yazılmış dosyalar ÖNCESİ'ne geri. GERI=1: canlı == SONRASI olanları ÖNCESİ'ne yazar.
# KURU=1: kapılar, PUT yok. Yazım sırası: önce CSS (mobil sızıntı), sonra çok-al şablonu.
import json, urllib.request, urllib.parse, os, hashlib, time, sys
B = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, B); import yama
T = os.environ['SHOPIFY_ADMIN_ACCESS_TOKEN']; D = os.environ['SHOPIFY_STORE_DOMAIN']; V = os.environ['SHOPIFY_API_VERSION']
H = {'X-Shopify-Access-Token': T}; TEMA = '195348856964'; M = json.load(open(B + '/md5.json'))
SIRA = [yama.CSS, yama.TPL]
md5 = lambda s: hashlib.md5(s.encode()).hexdigest(); U = f'https://{D}/admin/api/{V}/themes/{TEMA}/assets.json'
get = lambda k: json.load(urllib.request.urlopen(urllib.request.Request(U + '?asset%5Bkey%5D=' + urllib.parse.quote(k), headers=H), timeout=60))['asset']['value']
put = lambda k, v: urllib.request.urlopen(urllib.request.Request(U, data=json.dumps({'asset': {'key': k, 'value': v}}).encode(), method='PUT', headers={**H, 'Content-Type': 'application/json'}), timeout=60).status
oku = lambda k: open(B + '/ONCESI/' + k.replace('/', '__'), encoding='utf-8').read()
def bekle(k, h):
    for _ in range(12):
        time.sleep(2); g = md5(get(k))
        if g == h: return g
    return g
canli = {k: get(k) for k in SIRA}
for k in SIRA: print('CANLI', k, md5(canli[k]))
if os.environ.get('GERI'):
    for k in reversed(SIRA):
        h = md5(canli[k])
        if h == M[k]['once']: print('ZATEN-ONCESI', k); continue
        if h != M[k]['sonra']: print('DUR: ne öncesi ne sonrası', k); sys.exit(1)
        print('GERI PUT', k, put(k, oku(k)), 'GET-BACK', bekle(k, M[k]['once']) == M[k]['once'])
    sys.exit(0)
if all(md5(canli[k]) == M[k]['sonra'] for k in SIRA): print('ZATEN-BASILI'); sys.exit(0)
yeni = {}
for k in SIRA:
    if md5(canli[k]) != M[k]['once']: print('DUR: canlı != ÖNCESİ', k, md5(canli[k])); sys.exit(1)
    yeni[k] = yama.uygula(k, canli[k])
    if md5(yeni[k]) != M[k]['sonra']: print('DUR: yama md5', k); sys.exit(1)
    print('ON-KAPI OK', k, M[k]['once'], '->', M[k]['sonra'])
if os.environ.get('KURU'): print('KURU: PUT YOK'); sys.exit(0)
yazilan = []
try:
    for k in SIRA:
        st = put(k, yeni[k]); yazilan.append(k); g = bekle(k, M[k]['sonra']); print('PUT', k, st, 'GET-BACK', 'OK' if g == M[k]['sonra'] else '!!' + g)
        if g != M[k]['sonra']: raise RuntimeError('get-back ' + k)
except Exception as e:
    print('HATA', repr(e)[:200], '→ GERI')
    for k in reversed(yazilan): put(k, canli[k]); print('GERI', k, bekle(k, M[k]['once']) == M[k]['once'])
    sys.exit(1)
print('BASIM TAMAM')
