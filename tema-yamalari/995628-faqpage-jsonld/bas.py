# #995628 · FAQPage JSON-LD — sunucuda koşar (jeton yerel makineye inmez). İskelet #995332 bas.py'den KOPYA (o pakete dokunulmadı).
# KIP=ONIZLEME : canlıyı themeDuplicate ile kopyalar (ya da ONIZLEME_ID verilen temayı kullanır) ve yamayı ONA basar. CANLIYA YAZMAZ.
# KIP=CANLI    : yamayı canlı temaya (195348856964) basar — YALNIZ Yunus (#995332 kararı) + Mehmet canlıya-geçiş onayından sonra.
# KIP=GERI     : TEMA_ID temasında snippets/via-product-tabs.liquid dosyasını ÖNCESİ'ne döndürür (tek dosya).
# SIFIRLA=1    : (yalnız ONIZLEME_ID ile) önizleme temasını önce CANLI TABANINA eşitler — her dosya ÖNCESİ içeriğine yazılır,
#                sonra yamayı basar. Canlının md5'i ÖNCESİ değilse DURUR (taban bayatsa yazmaz).
# KURU=1       : kapılar koşar, yazma yok.  Her dosya: canlı md5 == ÖNCESİ kapısı → yama → md5 == SONRASI → PUT → GET-back.
import json, urllib.request, urllib.parse, urllib.error, os, hashlib, time, sys
B = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, B); import yama
T = os.environ['SHOPIFY_ADMIN_ACCESS_TOKEN']; D = os.environ['SHOPIFY_STORE_DOMAIN']; V = os.environ['SHOPIFY_API_VERSION']
H = {'X-Shopify-Access-Token': T}; CANLI = '195348856964'; M = json.load(open(B + '/md5.json'))
md5 = lambda s: hashlib.md5(s.encode()).hexdigest(); KIP = os.environ.get('KIP', 'ONIZLEME')
SIRA = ['snippets/via-product-tabs.liquid']

def gql(q, v=None):
    r = json.load(urllib.request.urlopen(urllib.request.Request(f'https://{D}/admin/api/{V}/graphql.json', data=json.dumps({'query': q, 'variables': v or {}}).encode(), headers={**H, 'Content-Type': 'application/json'}), timeout=90))
    if r.get('errors'): raise SystemExit('GQL ' + json.dumps(r['errors'])[:400])
    return r['data']
def url(t, k=None): return f'https://{D}/admin/api/{V}/themes/{t}/assets.json' + (f'?asset%5Bkey%5D={urllib.parse.quote(k)}' if k else '')
def get(t, k):
    try: return json.load(urllib.request.urlopen(urllib.request.Request(url(t, k), headers=H), timeout=60))['asset']['value']
    except urllib.error.HTTPError as e:
        if e.code == 404: return None
        raise
def put(t, k, v): return urllib.request.urlopen(urllib.request.Request(url(t), data=json.dumps({'asset': {'key': k, 'value': v}}).encode(), method='PUT', headers={**H, 'Content-Type': 'application/json'}), timeout=60).status
def sil(t, k): return urllib.request.urlopen(urllib.request.Request(url(t, k), method='DELETE', headers=H), timeout=60).status
def bekle(t, k, h):
    for _ in range(12):
        time.sleep(2); v = get(t, k); g = md5(v) if v is not None else None
        if g == h: return g
    return g

if KIP == 'GERI':
    t = os.environ['TEMA_ID']
    for k in SIRA:
        v = get(t, k); h = md5(v) if v is not None else None
        if h == M[k]['once']: print('ZATEN-ONCESI', k); continue
        if h != M[k]['sonra']: print('DUR: ne öncesi ne sonrası', k, h); sys.exit(1)
        if M[k]['once'] is None: sil(t, k); print('GERI', k, 'SIL', get(t, k) is None)
        else: put(t, k, open(B + '/ONCESI/' + k.replace('/', '__'), encoding='utf-8').read()); print('GERI', k, bekle(t, k, M[k]['once']) == M[k]['once'])
    sys.exit(0)

if KIP == 'CANLI':
    # #995628: canlı basım Yunus'un #995332 kararına ve Mehmet'in canlıya-geçiş onayına bağlı — açık onay anahtarı olmadan koşmaz.
    if os.environ.get('CANLI_ONAY') != '995628-yunus-mehmet': raise SystemExit('DUR: KIP=CANLI için CANLI_ONAY=995628-yunus-mehmet gerekir (onay yok)')
    t = CANLI
elif os.environ.get('ONIZLEME_ID'): t = os.environ['ONIZLEME_ID']
else:
    if os.environ.get('KURU'): t = CANLI; print('KURU: kopya açılmadı, kapılar canlı üzerinde OKUNARAK ölçülüyor')
    else:
        d = gql('mutation($id:ID!,$n:String){themeDuplicate(id:$id,name:$n){newTheme{id name} userErrors{field message}}}',
                {'id': f'gid://shopify/OnlineStoreTheme/{CANLI}', 'n': '995628 FAQPage JSON-LD ÖNİZLEME (Deniz)'})['themeDuplicate']
        if d['userErrors']: raise SystemExit('DUP ' + json.dumps(d['userErrors']))
        t = d['newTheme']['id'].split('/')[-1]; print('ONIZLEME_TEMA', t)
        for _ in range(60):
            time.sleep(5); s = gql('query($id:ID!){theme(id:$id){processing role}}', {'id': d['newTheme']['id']})['theme']
            if not s['processing']: break
        print('KOPYA HAZIR', s)
        if s['role'] == 'MAIN': raise SystemExit('DUR: kopya MAIN görünüyor')
if t == CANLI and KIP != 'CANLI' and not os.environ.get('KURU'): raise SystemExit('DUR: canlıya yalnız KIP=CANLI ile yazılır')
if os.environ.get('SIFIRLA'):
    if t == CANLI: raise SystemExit('DUR: SIFIRLA canlıda koşmaz')
    for k in SIRA:
        c = get(CANLI, k); h = md5(c) if c is not None else None
        if h != M[k]['once']: print('DUR: canlı tabanı != ÖNCESİ', k, h); sys.exit(1)
    for k in SIRA:
        v = get(t, k); h = md5(v) if v is not None else None
        if h == M[k]['once']: continue
        if os.environ.get('KURU'): print('KURU SIFIRLA (yazılmadı)', k, h, '→', M[k]['once']); continue
        if M[k]['once'] is None: sil(t, k); print('SIFIRLA', k, 'SIL', get(t, k) is None)
        else: put(t, k, open(B + '/ONCESI/' + k.replace('/', '__'), encoding='utf-8').read()); print('SIFIRLA', k, bekle(t, k, M[k]['once']) == M[k]['once'])

yeni = {}; once = {}
for k in SIRA:
    v = get(t, k); h = md5(v) if v is not None else None
    if h == M[k]['sonra']: print('ZATEN-BASILI', k); continue
    if h != M[k]['once']: print('DUR: tema', t, k, h, '!= ÖNCESİ', M[k]['once']); sys.exit(1)
    once[k] = v
    if v is None: print('DUR: dosya temada yok', k); sys.exit(1)
    s = yama.uygula(k, v)
    if md5(s) != M[k]['sonra']: print('DUR: yama md5', k); sys.exit(1)
    yeni[k] = s; print('ON-KAPI OK', k)
if os.environ.get('KURU'): print('KURU: PUT YOK'); sys.exit(0)
basilan = []
try:
    for k in SIRA:
        if k not in yeni: continue
        st = put(t, k, yeni[k]); basilan.append(k); g = bekle(t, k, M[k]['sonra'])
        print('PUT', k, st, 'GET-BACK', 'OK' if g == M[k]['sonra'] else '!!' + str(g))
        if g != M[k]['sonra']: raise RuntimeError('get-back ' + k)
        time.sleep(0.6)
except Exception as e:
    print('HATA', repr(e)[:300], '→ GERI-ALMA')
    for k in reversed(basilan):
        if once[k] is None: sil(t, k)
        else: put(t, k, once[k])
        print('GERI', k)
    sys.exit(1)
print('BASIM TAMAM tema', t, '· önizleme: https://viamood.com.tr/products/tabure-takim-cantasi?preview_theme_id=' + t)
