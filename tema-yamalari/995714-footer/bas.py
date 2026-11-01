# #995714 sunucu basımı: canlı GET → md5 == ÖNCESİ → yama → md5 == SONRASI → PUT → GET-back; hata → otomatik geri.
# GERI=1: canlı == SONRASI ise ÖNCESİ'ni yazar. KURU=1: kapılar, PUT yok.
import json, urllib.request, urllib.parse, os, hashlib, time, sys
B = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, B); import yama
T = os.environ['SHOPIFY_ADMIN_ACCESS_TOKEN']; D = os.environ['SHOPIFY_STORE_DOMAIN']; V = os.environ['SHOPIFY_API_VERSION']
H = {'X-Shopify-Access-Token': T}; TEMA = '195348856964'; K = yama.K; M = json.load(open(B + '/md5.json'))
md5 = lambda s: hashlib.md5(s.encode()).hexdigest(); U = f'https://{D}/admin/api/{V}/themes/{TEMA}/assets.json'
get = lambda: json.load(urllib.request.urlopen(urllib.request.Request(U + '?asset%5Bkey%5D=' + urllib.parse.quote(K), headers=H), timeout=60))['asset']['value']
put = lambda v: urllib.request.urlopen(urllib.request.Request(U, data=json.dumps({'asset': {'key': K, 'value': v}}).encode(), method='PUT', headers={**H, 'Content-Type': 'application/json'}), timeout=60).status
def bekle(h):
    for _ in range(12):
        time.sleep(2); g = md5(get())
        if g == h: return g
    return g
canli = get(); h = md5(canli); print('CANLI', h)
if os.environ.get('GERI'):
    if h == M['once']: print('ZATEN-ONCESI'); sys.exit(0)
    if h != M['sonra']: print('DUR: ne öncesi ne sonrası'); sys.exit(1)
    print('PUT', put(open(B + '/ONCESI/' + K.replace('/', '__'), encoding='utf-8').read()), 'GET-BACK', bekle(M['once']) == M['once']); sys.exit(0)
if h == M['sonra']: print('ZATEN-BASILI'); sys.exit(0)
if h != M['once']: print('DUR: canlı != ÖNCESİ', h); sys.exit(1)
yeni = yama.uygula(K, canli)
if md5(yeni) != M['sonra']: print('DUR: yama md5'); sys.exit(1)
print('ON-KAPI OK', M['once'], '->', M['sonra'])
if os.environ.get('KURU'): print('KURU: PUT YOK'); sys.exit(0)
try:
    st = put(yeni); g = bekle(M['sonra']); print('PUT', st, 'GET-BACK', 'OK' if g == M['sonra'] else '!!' + g)
    if g != M['sonra']: raise RuntimeError('get-back')
except Exception as e:
    print('HATA', repr(e)[:200], '→ GERI'); put(canli); print('GERI', bekle(M['once']) == M['once']); sys.exit(1)
print('BASIM TAMAM')
