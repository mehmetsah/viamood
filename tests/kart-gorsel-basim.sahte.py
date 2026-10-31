# #995332 · E9 — bas.py'yi SAHTE Shopify katmanında koşturan koşum (kart-gorsel-basim.test.ts çağırır).
# Gerçek ağa HİÇ çıkılmaz: urllib.request.urlopen yakalanır, soket bağlantısı yasaklanır (deneme sayılır ve raporlanır),
# time.sleep etkisizdir. bas.py paketin GEÇİCİ KOPYASINDA koşar — paket baytları değişemez.
# Girdi: argv[1] = paket dizini, argv[2] = senaryo JSON. Çıktı: TEK satır JSON.
#   senaryo.env      : bas.py'ye verilecek KIP / ONIZLEME_ID / TEMA_ID / KURU / SIFIRLA
#   senaryo.temalar  : {tema: {anahtar: 'once' | 'sonra' | 'baska'}}  (verilmeyen anahtar = temada YOK)
#   senaryo.bayat    : {anahtar: n}  ilk PUT'tan sonra n GET eski değeri döner (n >= 99: hep)
#   senaryo.boz_yaz  : [anahtar]     ilk PUT içeriği bozarak saklar
#   senaryo.put_hata / get_hata : [anahtar]  ilk PUT / her GET HTTP 500 verir
#   senaryo.dup      : {userErrors, role, isleme (processing=True kaç sorgu), gql_hata}
#   senaryo.yama_boz : [anahtar]     yama.uygula çıktısına bir bayt ekler
#   senaryo.dosya_ek : {paket-göreli dosya: ek}  geçici kopyadaki dosyaya bayt ekler
import contextlib, hashlib, io, json, os, runpy, shutil, socket, sys, tempfile, time, urllib.error, urllib.parse, urllib.request

P, S = sys.argv[1], json.loads(sys.argv[2])
ALAN, SURUM, JETON, CANLI, KOPYA = 'sahte-995332.invalid', '2025-01', 'sahte-jeton', '195348856964', '197000000001'
md5 = lambda s: hashlib.md5(s.encode()).hexdigest()
T = tempfile.mkdtemp(prefix='e9-basim-')
for f in ['bas.py', 'yama.py', 'md5.json', 'ek-blok.css']: shutil.copy(os.path.join(P, f), T)
for d in ['ONCESI', 'SONRASI', 'YENI']: shutil.copytree(os.path.join(P, d), os.path.join(T, d))
M = json.load(open(os.path.join(T, 'md5.json')))
oku = lambda d, k: open(os.path.join(T, d, k.replace('/', '__')), encoding='utf-8').read()
def icerik(k, h):
    if h == 'once': return None if M[k]['once'] is None else oku('ONCESI', k)
    if h == 'sonra': return oku('YENI' if M[k]['once'] is None else 'SONRASI', k)
    return 'baska ' + k
TEMA = {t: {k: icerik(k, h) for k, h in a.items()} for t, a in S.get('temalar', {}).items()}
for f, ek in S.get('dosya_ek', {}).items():  # tema içerikleri kurulduktan SONRA: yalnız paket kopyası bozulur
    with open(os.path.join(T, f), 'a', encoding='utf-8') as d: d.write(ek)
IST, AG, BAYAT, ESKI, SOYLEN = [], [], dict(S.get('bayat', {})), {}, set()
DUP = S.get('dup', {})

def hata(u, kod): return urllib.error.HTTPError(u, kod, 'sahte', {}, io.BytesIO(b'{}'))
class Yanit(io.BytesIO):
    def __init__(self, veri, status=200): super().__init__(json.dumps(veri).encode()); self.status = status

def sahte_urlopen(req, timeout=None):
    u = urllib.parse.urlsplit(req.full_url); y = req.get_method()
    if u.scheme != 'https' or u.netloc != ALAN: raise hata(req.full_url, 400)
    if req.get_header('X-shopify-access-token') != JETON: raise hata(req.full_url, 401)
    if u.path == f'/admin/api/{SURUM}/graphql.json':
        if y != 'POST' or req.get_header('Content-type') != 'application/json': raise hata(req.full_url, 400)
        g = json.loads(req.data)
        if 'themeDuplicate' in g['query']:
            IST.append({'y': 'DUP', 'id': g['variables']['id']})
            if DUP.get('gql_hata'): return Yanit({'errors': [{'message': 'sahte gql hatası'}]})
            if DUP.get('userErrors'): return Yanit({'data': {'themeDuplicate': {'newTheme': None, 'userErrors': DUP['userErrors']}}})
            if g['variables']['id'] != f'gid://shopify/OnlineStoreTheme/{CANLI}': raise hata(req.full_url, 404)
            TEMA[KOPYA] = dict(TEMA.get(CANLI, {}))
            return Yanit({'data': {'themeDuplicate': {'newTheme': {'id': f'gid://shopify/OnlineStoreTheme/{KOPYA}', 'name': g['variables']['n']}, 'userErrors': []}}})
        IST.append({'y': 'SORGU', 'id': g['variables']['id']})
        n = sum(1 for i in IST if i['y'] == 'SORGU')
        return Yanit({'data': {'theme': {'processing': n <= DUP.get('isleme', 0), 'role': DUP.get('role', 'UNPUBLISHED')}}})
    p = u.path.split('/')
    if len(p) != 7 or p[1:4] != ['admin', 'api', SURUM] or p[4] != 'themes' or p[6] != 'assets.json': raise hata(req.full_url, 404)
    t, q = p[5], urllib.parse.parse_qs(u.query)
    if y == 'PUT':
        if u.query or req.get_header('Content-type') != 'application/json': raise hata(req.full_url, 400)
        a = json.loads(req.data)['asset']; k, v = a['key'], a['value']
        IST.append({'y': 'PUT', 't': t, 'k': k})
        if k in S.get('put_hata', []) and ('p' + k) not in SOYLEN: SOYLEN.add('p' + k); raise hata(req.full_url, 500)
        ESKI[(t, k)] = TEMA.setdefault(t, {}).get(k)
        if k in S.get('boz_yaz', []) and ('b' + k) not in SOYLEN: SOYLEN.add('b' + k); v = v + ' BOZUK'
        TEMA[t][k] = v
        return Yanit({'asset': {'key': k}})
    if list(q) != ['asset[key]'] or len(q['asset[key]']) != 1 or req.data is not None: raise hata(req.full_url, 400)
    k = q['asset[key]'][0]
    IST.append({'y': y, 't': t, 'k': k})
    if y == 'DELETE':
        if TEMA.get(t, {}).get(k) is None: raise hata(req.full_url, 404)
        del TEMA[t][k]; return Yanit({'message': 'silindi'})
    if y != 'GET': raise hata(req.full_url, 405)
    if k in S.get('get_hata', []): raise hata(req.full_url, 500)
    if (t, k) in ESKI and BAYAT.get(k, 0) > 0:
        BAYAT[k] -= 1; v = ESKI[(t, k)]
    else: v = TEMA.get(t, {}).get(k)
    if v is None: raise hata(req.full_url, 404)
    return Yanit({'asset': {'key': k, 'value': v}})

def ag_yasak(*a, **kw): AG.append(repr(a)[:120]); raise OSError('E9: ağ erişimi yasak')
socket.socket.connect = ag_yasak; socket.socket.connect_ex = ag_yasak; socket.create_connection = ag_yasak; socket.getaddrinfo = ag_yasak
urllib.request.urlopen = sahte_urlopen
time.sleep = lambda s: None
if S.get('ag_dene'):
    try: socket.create_connection(('example.com', 443), timeout=1)
    except OSError: pass

sys.path.insert(0, T); import yama
_uygula = yama.uygula
yama.uygula = lambda k, v: _uygula(k, v) + ('X' if k in S.get('yama_boz', []) else '')
os.environ.update({'SHOPIFY_ADMIN_ACCESS_TOKEN': JETON, 'SHOPIFY_STORE_DOMAIN': ALAN, 'SHOPIFY_API_VERSION': SURUM})
for k in ['KIP', 'ONIZLEME_ID', 'TEMA_ID', 'KURU', 'SIFIRLA']: os.environ.pop(k, None)
os.environ.update(S.get('env', {}))

out, cikis = io.StringIO(), 0
with contextlib.redirect_stdout(out):
    try: runpy.run_path(os.path.join(T, 'bas.py'), run_name='__main__')
    except SystemExit as e: cikis = e.code if isinstance(e.code, int) or e.code is None else str(e.code)
    except Exception as e: cikis = 'ISTISNA ' + type(e).__name__ + ' ' + str(e)[:200]
shutil.rmtree(T)

def hal(k, v):
    if v is None: return 'yok'
    if md5(v) == M[k]['sonra']: return 'sonra'
    if M[k]['once'] is not None and md5(v) == M[k]['once']: return 'once'
    return 'baska'
print(json.dumps({'cikis': cikis or 0, 'cikti': out.getvalue().strip().split('\n') if out.getvalue().strip() else [], 'istek': IST, 'ag': AG,
                  'son': {t: {k: hal(k, v) for k, v in sorted(a.items()) if v is not None} for t, a in sorted(TEMA.items())}}, ensure_ascii=False))
