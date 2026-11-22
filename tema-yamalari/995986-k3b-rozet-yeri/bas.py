# #995986 k3b — kazanc rozetini «Vergiler dahildir.»in ALTINA tasir. Iskelet 995628-faqpage-jsonld
# bas.py'den KOPYA (o pakete dokunulmadi). YEREL kosar:
#     python tema-yamalari/yerel-bas.py 995986-k3b-rozet-yeri [KURU=1 | KIP=... ]
# (eski calistir.sh + AWS SSM yontemi KULLANILMIYOR; kimlik .env.local'den ortam degiskeni olarak gelir)
#
# KIP=ONIZLEME (varsayilan): canliyi themeDuplicate ile KOPYALAR (ya da ONIZLEME_ID verilen temayi
#              kullanir) ve yamayi ONA basar. CANLIYA YAZMAZ. Sonunda onizleme linkini basar.
# KIP=CANLI  : canli temaya (195348856964) basar — CANLI_ONAY anahtari sart (+ yerel-bas.py'de
#              --canliya-bas bayragi).
# KIP=GERI   : TEMA_ID temasinda her iki dosyayi TERS sirayla ONCESI'ne dondurur.
# SIFIRLA=1  : (yalniz onizlemede) onizleme temasini once CANLI TABANINA esitler; canlinin md5'i
#              ONCESI degilse DURUR (taban bayatsa yazmaz).
# KURU=1     : kapilar kosar, YAZMA YOK. Kopya da acilmaz; kapilar canli OKUNARAK olculur.
#
# Her dosya icin akis: GET -> md5 == ONCESI (ya da == SONRASI -> ZATEN-BASILI) -> yama.uygula ->
# md5 == SONRASI -> CR KAPISI -> (HEPSI gectikten sonra) PUT -> 12x2 s GET-back.
# Hata olursa yazilmis dosyalar TERS sirayla eski icerikleriyle geri yazilir.
#
# LF: ONCESI/SONRASI dosyalari yama.oku() ile IKILI kipte okunur; PUT'tan ONCE '\r' kapisi var —
# canliya ASLA CRLF gitmez.
import json, urllib.request, urllib.parse, urllib.error, os, hashlib, time, sys

B = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, B); import yama

T = os.environ['SHOPIFY_ADMIN_ACCESS_TOKEN']
D = os.environ['SHOPIFY_STORE_DOMAIN']
V = os.environ['SHOPIFY_API_VERSION']
H = {'X-Shopify-Access-Token': T}

CANLI = '195348856964'
ONAY = '995986-k3b-yunus'
ONIZLEME_AD = '995986 k3b rozet yeri ONIZLEME (Yunus)'
ORNEK = 'etiketli-18li-antrasit-ekonomik-kirilmaz-saklama-kabi-seti-x6-175-12-05-lt'

M = json.loads(yama.oku(os.path.join(B, 'md5.json')))
SIRA = yama.SIRA
md5 = lambda s: hashlib.md5(s.encode('utf-8')).hexdigest()
KIP = os.environ.get('KIP', 'ONIZLEME')
KURU = bool(os.environ.get('KURU'))

for k in SIRA:
    if M[k]['once'] is None:
        raise SystemExit('DUR: bu paket YENI dosya icermez; md5.json bozuk: ' + k)


def gql(q, v=None):
    r = json.load(urllib.request.urlopen(urllib.request.Request(
        'https://%s/admin/api/%s/graphql.json' % (D, V),
        data=json.dumps({'query': q, 'variables': v or {}}).encode(),
        headers=dict(H, **{'Content-Type': 'application/json'})), timeout=90))
    if r.get('errors'):
        raise SystemExit('GQL ' + json.dumps(r['errors'])[:400])
    return r['data']


def url(t, k=None):
    u = 'https://%s/admin/api/%s/themes/%s/assets.json' % (D, V, t)
    return u + ('?asset%5Bkey%5D=' + urllib.parse.quote(k) if k else '')


def get(t, k):
    try:
        return json.load(urllib.request.urlopen(
            urllib.request.Request(url(t, k), headers=H), timeout=60))['asset']['value']
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def put(t, k, v):
    if '\r' in v:                      # CR KAPISI — canliya asla CRLF gitmez
        raise SystemExit('DUR: CR iceren icerik gonderilemez: ' + k)
    return urllib.request.urlopen(urllib.request.Request(
        url(t), data=json.dumps({'asset': {'key': k, 'value': v}}).encode(), method='PUT',
        headers=dict(H, **{'Content-Type': 'application/json'})), timeout=60).status


def dosya(klasor, k):
    y = os.path.join(B, klasor, k.replace('/', '__'))
    s = yama.oku(y)                    # IKILI kip -> her zaman LF
    bek = M[k]['once'] if klasor == 'ONCESI' else M[k]['sonra']
    if md5(s) != bek:
        raise SystemExit('DUR: %s/%s dosyasi md5.json ile tutmuyor' % (klasor, k))
    return s


def bekle(t, k, h):
    g = None
    for _ in range(12):
        time.sleep(2)
        v = get(t, k)
        g = md5(v) if v is not None else None
        if g == h:
            return g
    return g


# ---------------- GERI ----------------
if KIP == 'GERI':
    t = os.environ['TEMA_ID']
    for k in reversed(SIRA):
        v = get(t, k)
        h = md5(v) if v is not None else None
        if h == M[k]['once']:
            print('ZATEN-ONCESI', k); continue
        if h != M[k]['sonra']:
            print('DUR: ne oncesi ne sonrasi', k, h); sys.exit(1)
        o = dosya('ONCESI', k)
        if KURU:
            print('KURU GERI (yazilmadi)', k, h, '->', M[k]['once']); continue
        print('GERI PUT', k, put(t, k, o), 'GET-BACK', bekle(t, k, M[k]['once']) == M[k]['once'])
    sys.exit(0)

# ---------------- tema secimi ----------------
if KIP == 'CANLI':
    if os.environ.get('CANLI_ONAY') != ONAY:
        raise SystemExit('DUR: KIP=CANLI icin CANLI_ONAY=%s gerekir (onay yok)' % ONAY)
    t = CANLI
elif os.environ.get('ONIZLEME_ID'):
    t = os.environ['ONIZLEME_ID']
elif KURU:
    t = CANLI
    print('KURU: kopya acilmadi, kapilar canli uzerinde OKUNARAK olculuyor')
else:
    d = gql('mutation($id:ID!,$n:String){themeDuplicate(id:$id,name:$n)'
            '{newTheme{id name} userErrors{field message}}}',
            {'id': 'gid://shopify/OnlineStoreTheme/' + CANLI, 'n': ONIZLEME_AD})['themeDuplicate']
    if d['userErrors']:
        raise SystemExit('DUP ' + json.dumps(d['userErrors']))
    t = d['newTheme']['id'].split('/')[-1]
    print('ONIZLEME_TEMA', t)
    s = None
    for _ in range(60):
        time.sleep(5)
        s = gql('query($id:ID!){theme(id:$id){processing role}}', {'id': d['newTheme']['id']})['theme']
        if not s['processing']:
            break
    print('KOPYA HAZIR', s)
    if s is None or s['role'] == 'MAIN':
        raise SystemExit('DUR: kopya MAIN gorunuyor')

if t == CANLI and KIP != 'CANLI' and not KURU:
    raise SystemExit('DUR: canliya yalniz KIP=CANLI ile yazilir')

# ---------------- SIFIRLA ----------------
if os.environ.get('SIFIRLA'):
    if t == CANLI:
        raise SystemExit('DUR: SIFIRLA canlida kosmaz')
    for k in SIRA:
        c = get(CANLI, k)
        h = md5(c) if c is not None else None
        if h != M[k]['once']:
            print('DUR: canli tabani != ONCESI', k, h); sys.exit(1)
    for k in SIRA:
        v = get(t, k)
        h = md5(v) if v is not None else None
        if h == M[k]['once']:
            continue
        if KURU:
            print('KURU SIFIRLA (yazilmadi)', k, h, '->', M[k]['once']); continue
        print('SIFIRLA', k, put(t, k, dosya('ONCESI', k)),
              bekle(t, k, M[k]['once']) == M[k]['once'])

# ---------------- kapilar (HEPSI yazimdan ONCE) ----------------
canli = {k: get(t, k) for k in SIRA}
for k in SIRA:
    print('TEMA', t, k, md5(canli[k]) if canli[k] is not None else 'YOK')

yeni, once = {}, {}
for k in SIRA:
    v = canli[k]
    h = md5(v) if v is not None else None
    if h == M[k]['sonra']:
        print('ZATEN-BASILI', k); continue
    if v is None:
        print('DUR: dosya temada yok', k); sys.exit(1)
    if h != M[k]['once']:
        print('DUR: tema', t, k, h, '!= ONCESI', M[k]['once']); sys.exit(1)
    if '\r' in v:
        print('DUR: canli icerikte CR var', k); sys.exit(1)
    s = yama.uygula(k, v)
    if md5(s) != M[k]['sonra']:
        print('DUR: yama md5', k, md5(s), '!=', M[k]['sonra']); sys.exit(1)
    if s != dosya('SONRASI', k):
        print('DUR: yama cikisi SONRASI dosyasiyla bayt bayt ayni degil', k); sys.exit(1)
    if '\r' in s:
        print('DUR: yama cikisinda CR var', k); sys.exit(1)
    once[k], yeni[k] = v, s
    print('ON-KAPI OK', k)

if not yeni:
    print('YAPILACAK IS YOK (hepsi ZATEN-BASILI)'); sys.exit(0)
if KURU:
    print('KURU: PUT YOK'); sys.exit(0)

# ---------------- yazim + GET-back + geri alma ----------------
basilan = []
try:
    for k in SIRA:
        if k not in yeni:
            continue
        st = put(t, k, yeni[k]); basilan.append(k)
        g = bekle(t, k, M[k]['sonra'])
        print('PUT', k, st, 'GET-BACK', 'OK' if g == M[k]['sonra'] else '!!' + str(g))
        if g != M[k]['sonra']:
            raise RuntimeError('get-back ' + k)
        time.sleep(0.6)
except Exception as e:
    print('HATA', repr(e)[:300], '-> GERI-ALMA')
    for k in reversed(basilan):
        put(t, k, once[k]); print('GERI', k)
    sys.exit(1)

print('BASIM TAMAM tema', t)
print('onizleme: https://viamood.com.tr/products/%s?preview_theme_id=%s' % (ORNEK, t))
