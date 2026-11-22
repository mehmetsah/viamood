# TEMA YAMALARI — YEREL CALISTIRICI (tum paketler icin TEK betik; Windows'ta koşar)
#
# Eski yontem: her pakette calistir.sh, paketi tar+base64 ile AWS SSM uzerinden sunucuya
# atip orada /var/www/viamood/.env.production ile kosturuyordu (Mehmet'in makinesindeki
# ssm2.sh'a bagliydi). ARTIK KULLANILMIYOR. Bu betik bas.py'yi BU bilgisayarda kosturur.
#
# Shopify kimligi repo kokundeki .env.local'den (git'te yok: .gitignore ".env*.local")
# YALNIZ alt surecin ortam degiskeni olarak gecirilir. Degerler hicbir ciktiya, loga ya da
# dosyaya YAZILMAZ — sadece "3 anahtar yuklendi" satiri basilir.
#
# KULLANIM
#   python tema-yamalari/yerel-bas.py <paket> [AD=DEGER ...] [--canliya-bas]
#
#   python tema-yamalari/yerel-bas.py 995986-k3b-rozet-yeri KURU=1
#   python tema-yamalari/yerel-bas.py 995986-k3b-rozet-yeri KIP=ONIZLEME
#   python tema-yamalari/yerel-bas.py 995986-k3b-rozet-yeri KIP=CANLI CANLI_ONAY=... --canliya-bas
#   python tema-yamalari/yerel-bas.py 995986-k3b-rozet-yeri KIP=GERI TEMA_ID=195348856964
#
# KAPILAR
#   · paket klasorunde bas.py yoksa durur.
#   · KIP=CANLI yalnizca --canliya-bas bayragi da verilirse gecer (bas.py'nin kendi
#     CANLI_ONAY kapisinin USTUNE ikinci kilit). Bayrak KIP=CANLI olmadan kullanilamaz.
#   · Yalniz izinli degiskenler gecer; kabukta kalmis eski bir KIP/KURU sizmaz.
#   · Bu betik HICBIR dosya yazmaz.
#
# LF: .env.local ikili kipte okunur ve LF'e normallestirilir (bkz. koktek .gitattributes).
import os, subprocess, sys

try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

ANAHTARLAR = ('SHOPIFY_ADMIN_ACCESS_TOKEN', 'SHOPIFY_STORE_DOMAIN', 'SHOPIFY_API_VERSION')
GECEN = ('KURU', 'GERI', 'KIP', 'TEMA_ID', 'ONIZLEME_ID', 'SIFIRLA', 'CANLI_ONAY')
KULLANIM = ('kullanim: python tema-yamalari/yerel-bas.py <paket> [' + '|'.join(GECEN)
            + '=DEGER ...] [--canliya-bas]')


def oku_lf(y):
    """Dosyayi IKILI kipte okur ve her zaman LF dondurur (platformdan bagimsiz)."""
    b = open(y, 'rb').read()
    return b.replace(b'\r\n', b'\n').replace(b'\r', b'\n').decode('utf-8-sig')


def kimlik(kok):
    """.env.local'den yalniz SHOPIFY_* anahtarlari. Degerler DONDURULUR, basilmaz."""
    y = os.path.join(kok, '.env.local')
    if not os.path.isfile(y): raise SystemExit('DUR: bulunamadi: ' + y)
    d = {}
    for s in oku_lf(y).split('\n'):
        s = s.strip()
        if not s or s.startswith('#') or '=' not in s: continue
        ad, deger = s.split('=', 1)
        ad = ad.strip()
        if ad in ANAHTARLAR: d[ad] = deger.strip().strip('"').strip("'")
    eksik = [a for a in ANAHTARLAR if not d.get(a)]
    if eksik: raise SystemExit('DUR: .env.local icinde eksik/bos: ' + ', '.join(eksik))
    return d


B = os.path.dirname(os.path.abspath(__file__))   # .../tema-yamalari
KOK = os.path.dirname(B)                          # depo koku

arg = sys.argv[1:]
canliya = '--canliya-bas' in arg
arg = [a for a in arg if a != '--canliya-bas']
if not arg: raise SystemExit(KULLANIM)

paket = arg[0].strip('/' + os.sep)   # bas/son bolu isaretlerini at (iki platform)
ek = {}
for a in arg[1:]:
    if '=' not in a: raise SystemExit('DUR: anlasilmayan arguman: ' + a + '\n' + KULLANIM)
    ad, deger = a.split('=', 1); ad = ad.strip().upper()
    if ad not in GECEN:
        raise SystemExit('DUR: izin verilmeyen degisken: ' + ad + ' (izinli: ' + ', '.join(GECEN) + ')')
    ek[ad] = deger

P = os.path.join(B, paket)
if not os.path.isfile(os.path.join(P, 'bas.py')):
    raise SystemExit('DUR: bas.py yok: ' + os.path.join(P, 'bas.py'))
if ek.get('KIP') == 'CANLI' and not canliya:
    raise SystemExit('DUR: KIP=CANLI CANLI temaya YAZAR; --canliya-bas bayragi da gerekir.')
if canliya and ek.get('KIP') != 'CANLI':
    raise SystemExit('DUR: --canliya-bas yalniz KIP=CANLI ile kullanilir.')

ortam = dict(os.environ)
for a in GECEN: ortam.pop(a, None)      # kabukta kalmis eski deger sizmasin
ortam.update(kimlik(KOK))
ortam.update(ek)
ortam['PYTHONIOENCODING'] = 'utf-8'     # Turkce print'ler cp1254 konsolda patlamasin
ortam['PYTHONDONTWRITEBYTECODE'] = '1'

print('paket  :', paket)
print('kipler :', ' '.join('%s=%s' % (a, ek[a]) for a in sorted(ek)) or '(yok - bas.py varsayilani)')
print('kimlik : .env.local -> %d anahtar yuklendi (degerler basilmaz)' % len(ANAHTARLAR))
print('-' * 64)
sys.stdout.flush()

sys.exit(subprocess.run([sys.executable, '-X', 'utf8', '-B', 'bas.py'], cwd=P, env=ortam).returncode)
