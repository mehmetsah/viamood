# #995986 sunucu basımı (çok dosya): HER dosya için canlı GET → md5 == ÖNCESİ (yeni dosyada: yok ya da == SONRASI)
# → yama → md5 == SONRASI (önce HEPSİ, sonra yazım) → PUT → GET-back; hata → yazılmış dosyalar ÖNCESİ'ne geri.
# GERI=1: canlı == SONRASI olan YAMA dosyalarını ters sırayla ÖNCESİ'ne yazar. YENİ dosyalar SİLİNMEZ (kalıcı silme yok;
# referansı kalkınca kullanılmaz). KURU=1: kapılar, PUT yok. Sıra yama.SIRA'dadır.
import json, urllib.request, urllib.parse, urllib.error, os, hashlib, time, sys
B = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, B); import yama
T = os.environ['SHOPIFY_ADMIN_ACCESS_TOKEN']; D = os.environ['SHOPIFY_STORE_DOMAIN']; V = os.environ['SHOPIFY_API_VERSION']
H = {'X-Shopify-Access-Token': T}; TEMA = '195348856964'; M = json.load(open(B + '/md5.json'))
md5 = lambda s: hashlib.md5(s.encode()).hexdigest(); U = f'https://{D}/admin/api/{V}/themes/{TEMA}/assets.json'
def get(k):
    try: return json.load(urllib.request.urlopen(urllib.request.Request(U + '?asset%5Bkey%5D=' + urllib.parse.quote(k), headers=H), timeout=60))['asset']['value']
    except urllib.error.HTTPError as e:
        if e.code == 404: return None
        raise
put = lambda k, v: urllib.request.urlopen(urllib.request.Request(U, data=json.dumps({'asset': {'key': k, 'value': v}}).encode(), method='PUT', headers={**H, 'Content-Type': 'application/json'}), timeout=60).status
dosya = lambda kl, k: open(B + '/' + kl + '/' + k.replace('/', '__'), encoding='utf-8').read()
def bekle(k, h):
    g = None
    for _ in range(12):
        time.sleep(2); v = get(k); g = md5(v) if v is not None else None
        if g == h: return g
    return g
canli = {k: get(k) for k in yama.SIRA}
for k in yama.SIRA: print('CANLI', k, md5(canli[k]) if canli[k] is not None else 'YOK')
if os.environ.get('GERI'):
    for k in reversed(yama.SIRA):
        if M[k]['once'] is None: print('YENİ DOSYA SİLİNMEZ', k); continue
        h = md5(canli[k])
        if h == M[k]['once']: print('ZATEN-ONCESI', k); continue
        if h != M[k]['sonra']: print('DUR: ne öncesi ne sonrası', k); sys.exit(1)
        print('GERI PUT', k, put(k, dosya('ONCESI', k)), 'GET-BACK', bekle(k, M[k]['once']) == M[k]['once'])
    sys.exit(0)
if all(canli[k] is not None and md5(canli[k]) == M[k]['sonra'] for k in yama.SIRA): print('ZATEN-BASILI'); sys.exit(0)
yeni = {}
for k in yama.SIRA:
    if M[k]['once'] is None:
        if canli[k] is not None and md5(canli[k]) != M[k]['sonra']: print('DUR: yeni dosya canlıda FARKLI içerikle var', k); sys.exit(1)
        yeni[k] = dosya('YENI', k)
    else:
        if canli[k] is None or md5(canli[k]) != M[k]['once']: print('DUR: canlı != ÖNCESİ', k, md5(canli[k]) if canli[k] else 'YOK'); sys.exit(1)
        yeni[k] = yama.uygula(k, canli[k])
    if md5(yeni[k]) != M[k]['sonra']: print('DUR: yama md5', k); sys.exit(1)
    print('ON-KAPI OK', k, M[k]['once'], '->', M[k]['sonra'])
if os.environ.get('KURU'): print('KURU: PUT YOK'); sys.exit(0)
yazilan = []
try:
    for k in yama.SIRA:
        st = put(k, yeni[k]); yazilan.append(k); g = bekle(k, M[k]['sonra']); print('PUT', k, st, 'GET-BACK', 'OK' if g == M[k]['sonra'] else '!!' + str(g))
        if g != M[k]['sonra']: raise RuntimeError('get-back ' + k)
except Exception as e:
    print('HATA', repr(e)[:300], '→ GERI')
    for k in reversed(yazilan):
        if M[k]['once'] is None: print('YENİ DOSYA SİLİNMEZ', k); continue
        put(k, canli[k]); print('GERI', k, bekle(k, M[k]['once']) == M[k]['once'])
    sys.exit(1)
print('BASIM TAMAM')
