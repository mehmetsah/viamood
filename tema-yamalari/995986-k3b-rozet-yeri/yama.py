# #995986 k3b — KAZANC ROZETININ YERI: urun adinin USTU -> FIYATIN ALTI
# (Yunus 22 Kas: «yesil "Kazancinız 250TL" rozeti su an urun adinin USTUNDE. Bunu fiyatin
#  altindaki "Vergiler dahildir." yazisinin hemen ALTINA tasi.»)
#
# IKI dosya, iki capa. Hicbir ayar, renk, bosluk ya da CSS degismez:
#   1) templates/product.json  — YALNIZ product-details.block_order: via_kazanc, basindan
#      alinip price_a7krng'in HEMEN ARDINA konur. Saf siralama -> bayt sayisi DEGISMEZ.
#      blocks.via_kazanc TANIMI YERINDE BIRAKILIR (sozluk anahtar sirasi render'i etkilemez),
#      boylece JSON farki TEK yola iner.
#   2) blocks/via-kazanc.liquid — variant:update geri-dusumu. Rozet DOM'da yokken (ilk varyant
#      indirimsiz, kullanici indirimli varyanta geciyor) eski kod rozeti BASLIK blogunun onune
#      sokuyordu; tasimadan sonra yanlis yer olurdu. Artik once <product-price>'in ARDINA
#      konur. Eski h1 yolu YEDEK olarak aynen kalir -> product-price'i olmayan cok-al
#      sablonunda davranis degismez. Tutar hesabi, rozet cikti satiri, stylesheet ve schema
#      BAYT BAYT korunur (kapilar bunu dogrular).
#
# product.cok-al.json BU YAMADA YOK: orada «Vergiler dahildir.» via-cok-al.liquid'in ICINDE
# (.vqb__vat), adet kartlarinin ustunde; kardes blok block_order ile oraya GIREMEZ. O sablonu
# cok-al ekiyle tek urun kullaniyor ve o urunde indirim olmadigi icin rozet hic basilmiyor.
#
# LF: tum okuma/yazma IKILI kipte (platform cevirisi yok). Shopify'a ve md5'e giden icerik
# her zaman LF. Bkz. kok .gitattributes ve bas.py'nin PUT oncesi CR kapisi.
import json, os, re

BLK = 'blocks/via-kazanc.liquid'
TPL = 'templates/product.json'
SIRA = [BLK, TPL]                      # blok once; GERI ters sirayla isler
PD = ('sections', 'main', 'blocks', 'product-details')


# ---------- LF guvenceli dosya katmani ----------
def oku(y):
    """IKILI kipte okur, her zaman LF dondurur."""
    b = open(y, 'rb').read()
    return b.replace(b'\r\n', b'\n').replace(b'\r', b'\n').decode('utf-8')


def yaz(y, s):
    """IKILI kipte yazar. CR iceren icerik ASLA yazilmaz."""
    if '\r' in s:
        raise SystemExit('DUR: CR iceren icerik yazilamaz: ' + y)
    open(y, 'wb').write(s.encode('utf-8'))


# ---------- templates/product.json ----------
SIRA_CAPA = """            "via_kazanc",
            "text_GnyQiN",
            "reviews",
            "price_a7krng",
"""
SIRA_YENI = """            "text_GnyQiN",
            "reviews",
            "price_a7krng",
            "via_kazanc",
"""


def ayristir(s):
    return json.loads(s[s.index('{'):])


def farklar(a, b, yol=()):
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            out += farklar(a.get(k, 'YOK'), b.get(k, 'YOK'), yol + (k,))
        return out
    return [] if a == b else [yol]


def al(o, yol):
    for k in yol:
        o = o[k]
    return o


def _tpl(v):
    if SIRA_YENI in v:
        raise SystemExit('DUR %s: via_kazanc zaten tasinmis' % TPL)
    n = v.count(SIRA_CAPA)
    if n != 1:
        raise SystemExit('DUR %s: capa %d kez (1 beklenirdi): %r' % (TPL, n, SIRA_CAPA))
    s = v.replace(SIRA_CAPA, SIRA_YENI)
    o, y = ayristir(v), ayristir(s)
    f = farklar(o, y)
    if f != [PD + ('block_order',)]:
        raise SystemExit('DUR %s: beklenmeyen JSON farki %s' % (TPL, f))
    eski, yeni = al(o, PD + ('block_order',)), al(y, PD + ('block_order',))
    if sorted(eski) != sorted(yeni):
        raise SystemExit('DUR %s: block_order kumesi degisti' % TPL)
    if eski[0] != 'via_kazanc':
        raise SystemExit('DUR %s: via_kazanc basta degildi: %s' % (TPL, eski[:2]))
    if yeni.index('via_kazanc') != yeni.index('price_a7krng') + 1:
        raise SystemExit('DUR %s: via_kazanc price_a7krng ardina gelmedi: %s' % (TPL, yeni))
    if len(s) != len(v):
        raise SystemExit('DUR %s: saf siralama degil, uzunluk degisti' % TPL)
    return s


# ---------- blocks/via-kazanc.liquid ----------
YORUM_CAPA = """  ile gösterilmeli. Örnek: "Kazancınız 250₺"»). Yer: ürün adının ÜSTÜ (product-details block_order'da başlıktan önce).
"""
YORUM_YENI = """  ile gösterilmeli. Örnek: "Kazancınız 250₺"»). Yer (#995986 k3b · Yunus 22 Kas): FİYAT BLOĞUNUN ALTI —
  «Vergiler dahildir.» satırının hemen altı (product-details block_order'da price_a7krng'ten HEMEN SONRA).
  Ölçüm: .tax-note, <product-price>'ın son GÖRÜNÜR öğesi; ardındaki .installments içi boş bir <form> basıyor
  (payment_terms çıktı vermiyor) ve base.css'te margin-block: 0. product.cok-al.json DEĞİŞMEDİ — orada
  «Vergiler dahildir.» via-cok-al.liquid'in İÇİNDE (.vqb__vat); kardeş blok oraya giremez, o tek üründe
  rozet başlığın üstünde kalır (indirim olmadığı için hâlen hiç basılmıyor).
"""
JS_CAPA = """        var h1 = document.querySelector('.product-details h1');
        var baslik = h1 && h1.closest('.text-block');
        if (baslik) baslik.parentNode.insertBefore(document.importNode(yeni, true), baslik);
"""
JS_YENI = """        var fiyat = document.querySelector('.product-details product-price');
        if (fiyat && fiyat.parentNode) { fiyat.parentNode.insertBefore(document.importNode(yeni, true), fiyat.nextSibling); return; }
""" + JS_CAPA

# Yamadan sonra BAYT BAYT ayni kalmasi gereken bolumler:
HESAP = """{%- liquid
  assign urun = closest.product
  assign secili = urun.selected_or_first_available_variant
  assign kazanc = 0
  if secili.compare_at_price > secili.price
    assign kazanc = secili.compare_at_price | minus: secili.price
  endif
-%}
"""
ROZET = """  <p class="via-kazanc" data-via-kazanc {{ block.shopify_attributes }}>Kazancınız {{ kazanc | money_without_trailing_zeros }}</p>
"""
STIL = ('{% stylesheet %}', '{% endstylesheet %}')
SEMA = ('{% schema %}', '{% endschema %}')
RENKLER = {'#1c6b45', '#fff'}


def _dilim(s, bas, son):
    i = s.index(bas)
    return s[i:s.index(son, i) + len(son)]


def _blk(v):
    if 'product-price' in v:
        raise SystemExit('DUR %s: yama zaten uygulanmis (product-price capasi var)' % BLK)
    for ad, capa in (('yorum', YORUM_CAPA), ('js', JS_CAPA), ('hesap', HESAP), ('rozet', ROZET)):
        n = v.count(capa)
        if n != 1:
            raise SystemExit('DUR %s: %s capasi %d kez (1 beklenirdi)' % (BLK, ad, n))
    s = v.replace(YORUM_CAPA, YORUM_YENI).replace(JS_CAPA, JS_YENI)
    # Degismemesi gerekenler
    for ad, parca in (('hesap', HESAP), ('rozet', ROZET)):
        if s.count(parca) != 1:
            raise SystemExit('DUR %s: %s bolumu bozuldu' % (BLK, ad))
    for ad, (bas, son) in (('stylesheet', STIL), ('schema', SEMA)):
        if _dilim(v, bas, son) != _dilim(s, bas, son):
            raise SystemExit('DUR %s: %s bolumu degisti' % (BLK, ad))
    renk = set(x.lower() for x in re.findall('#[0-9a-fA-F]{3,6}', _dilim(s, *STIL)))
    if renk != RENKLER:
        raise SystemExit('DUR %s: renk kumesi degisti: %s' % (BLK, sorted(renk)))
    if re.search('toLocaleString|Intl[.]NumberFormat|formatMoney', s):
        raise SystemExit('DUR %s: JS para bicimliyor (tek kaynak Liquid olmali)' % BLK)
    if s.count('insertBefore') != 2:
        raise SystemExit('DUR %s: insertBefore sayisi 2 degil' % BLK)
    if '\r' in s:
        raise SystemExit('DUR %s: sonucta CR var' % BLK)
    return s


def uygula(k, v):
    if k == TPL:
        return _tpl(v)
    if k == BLK:
        return _blk(v)
    raise SystemExit('yama bu dosyaya degil: ' + k)


if __name__ == '__main__':
    import hashlib
    B = os.path.dirname(os.path.abspath(__file__))
    md5 = lambda s: hashlib.md5(s.encode('utf-8')).hexdigest()
    md = {}
    for k in SIRA:
        f = k.replace('/', '__')
        o = oku(os.path.join(B, 'ONCESI', f))
        s = uygula(k, o)
        yaz(os.path.join(B, 'SONRASI', f), s)
        md[k] = {'once': md5(o), 'sonra': md5(s)}
        print('%-30s %s -> %s' % (k, md5(o), md5(s)))
    yaz(os.path.join(B, 'md5.json'), json.dumps(md, ensure_ascii=False, indent=1) + '\n')
    print('md5.json yazildi')
