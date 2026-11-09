# #996126 · ayse:888 (Yunus 7 Kas 12:13) — ürün sayfası SABİT SATIN ALMA ŞERİDİ: ürün adı TAM (ellipsis yok) ·
# görsel 52 → 65 px (×1,25) · şerit arkadaki yatay alanı kaplar. YALNIZ CSS; Liquid'e dokunulmaz.
# Ölçülen (9 Kas, canlı, ürün 132): 1280'de şerit 600 × 114 kapsül, başlık sütunu 183px / metin 375px → kesiliyor;
# 390'da şerit 390 × 131, başlık sütunu 134px. Sayfa ızgarası 1280'de 40..1240 (en çok 1440); #wa-fab sağ altta 1200..1260.
#   1) via-product-overrides.css şerit ızgara bloğu: başlık sarar (white-space normal), görsel 65, masaüstü genişlik
#      min(1440, %100 − 192) — 192 = iki yanda #wa-fab payı (20 kenar + 60 düğme + 16 nefes); mobil üç sıra.
#      ≤359 «görsel çizilmez» kuralı kalkar: yeni düzende fiyat/başlık sütunu 219px, görsel sığıyor.
#   2) via-mobile-app.css #994650-FAB: mobilde şerit uzadığı için (131 → ~200) WhatsApp düğmesinin şerit üstü payı
#      200 → FAB_PAY. Masaüstünde düğmeye dokunulmaz.
# Hiyerarşi (ayse:730) AYNEN: Sepete ekle dolu birincil · Hemen al çerçeveli ikincil · WhatsApp şeride girmez.
# Yeni renk/jeton/yazı ölçüsü YOK: 65 = 52 × 1,25 (kayıt); 16/12 boşluklar mevcut --gap-md/--padding-sm değerleri.

OVR = 'assets/via-product-overrides.css'
MOB = 'assets/via-mobile-app.css'
SIRA = [OVR, MOB]
FAB_PAY = 288  # 64 nav + şerit (390, ad üç satır: 216) + 8 nefes; ölçüm: raporlar/996126-kanit
CSS_A = '/* sabit çubuk: ızgara — yükseklik 114 KORUNUR (12 + 18 + 20 + 52 + 12) */\nsticky-add-to-cart[data-variant-available="true"] .sticky-add-to-cart__bar{display:grid;grid-template-columns:52px minmax(0,1fr) auto auto;grid-template-areas:"satir satir satir satir" "gorsel bilgi hemen sepet" "gorsel fiyat hemen sepet";column-gap:16px;row-gap:0;align-items:center}\n.sticky-add-to-cart__bar > .vks-satir{grid-area:satir;margin-bottom:20px !important}\n.sticky-add-to-cart__image{grid-area:gorsel}\n.sticky-add-to-cart__info{grid-area:bilgi;align-self:end}\n.sticky-add-to-cart__price{grid-area:fiyat;align-self:start;white-space:nowrap}\n.sticky-add-to-cart__price [class*="price"]{font-size:16px !important;line-height:1.3 !important}\n'
CSS_A_YENI = (
    "/* sabit çubuk: ızgara — #996126 · ayse:888 (Yunus 7 Kas): ürün adı TAM (ellipsis yok), görsel 52 → 65 (×1,25),\n"
    "   şerit arkadaki yatay alanı kaplar. ayse:730'un «yükseklik 114 KORUNUR» ölçüsü bu kayıtla kalktı; hiyerarşi AYNEN:\n"
    "   Sepete ekle dolu (birincil) · Hemen al çerçeveli (ikincil) · WhatsApp şeride GİRMEZ.\n"
    "   ≥750: genişlik = sayfa ızgarası (en çok 1440) ama sağ alttaki #wa-fab'a İKİ YANDAN eşit pay (20 kenar + 60 düğme\n"
    "   + 16 nefes = 96) → 1280'de 1088, 1440'ta 1248, 1920'de 1440 (ızgarayla birebir). 16 + 18 + 16 + 65 + 16 = 131.\n"
    "   Kapsül köşesi korunur; 32px yan boşluk köşe eğrisinin içinde kalır (kargo satırı üstünde eğri 23px).\n"
    "   ≤749: üç sıra — kargo satırı · [görsel 65][ad (sarar) + fiyat] · [Hemen al | Sepete ekle] yarı yarıya. */\n"
    "sticky-add-to-cart[data-variant-available=\"true\"] .sticky-add-to-cart__bar{display:grid;grid-template-columns:65px minmax(0,1fr) auto auto;grid-template-areas:\"satir satir satir satir\" \"gorsel bilgi hemen sepet\" \"gorsel fiyat hemen sepet\";column-gap:16px;row-gap:0;align-items:center}\n"
    ".sticky-add-to-cart__bar > .vks-satir{grid-area:satir;margin-bottom:16px !important}\n"
    ".sticky-add-to-cart__image{grid-area:gorsel}\n"
    "/* Görsel 65: tema `height:var(--height-buy-buttons)` (52) compiled_assets'te SONRA yükleniyor — seçici güçlendirildi. */\n"
    "sticky-add-to-cart[data-variant-available=\"true\"] .sticky-add-to-cart__image{width:65px;height:65px}\n"
    ".sticky-add-to-cart__info{grid-area:bilgi;align-self:end}\n"
    "/* Ad kesilmez: tema `white-space:nowrap; text-overflow:ellipsis` ve ≤389'da `display:none` veriyor — ikisi de ezilir. */\n"
    "sticky-add-to-cart[data-variant-available=\"true\"] .sticky-add-to-cart__title{display:block;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:break-word}\n"
    ".sticky-add-to-cart__price{grid-area:fiyat;align-self:start;white-space:nowrap}\n"
    ".sticky-add-to-cart__price [class*=\"price\"]{font-size:16px !important;line-height:1.3 !important}\n"
)
CSS_B = '.sticky-add-to-cart__hemen{grid-area:hemen;width:auto;height:52px;padding:0 28px}\n.sticky-add-to-cart__button{grid-area:sepet}\n@media (max-width:749px){\n  sticky-add-to-cart[data-variant-available="true"] .sticky-add-to-cart__bar{column-gap:12px}\n  .sticky-add-to-cart__hemen{padding:0 16px;font-size:14px;font-weight:700;border-radius:10px}\n}\n/* ≤359px: fiyat ("5.000,00TL" = 93,2px) TAM sığsın. Ölçüldü: iç boşluk daraltma İŞLEMEZ — tema\n   via-mobile-app.css `[class*="add-to-cart"] button{padding:12px!important}` dayatıyor; daraltılsa bile sütun\n   ~84px kalırdı. Çözüm: bu genişlikte çubuktaki küçük görsel çizilmez (ürün görseli sayfada zaten ekranda),\n   başlık+fiyat sütunu ~136px olur. Yazı boyutu DEĞİŞMEZ (16/800 fiyat, 14/700 Hemen al). */\n@media (max-width:359px){\n  sticky-add-to-cart[data-variant-available="true"] .sticky-add-to-cart__bar{grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:"satir satir satir" "bilgi hemen sepet" "fiyat hemen sepet";column-gap:8px}\n  sticky-add-to-cart[data-variant-available="true"] .sticky-add-to-cart__image{display:none}\n}\n'
CSS_B_YENI = (
    ".sticky-add-to-cart__hemen{grid-area:hemen;width:auto;height:52px;padding:0 28px}\n"
    ".sticky-add-to-cart__button{grid-area:sepet}\n"
    "@media (min-width:750px){\n"
    "  sticky-add-to-cart[data-variant-available=\"true\"] .sticky-add-to-cart__bar{width:min(1440px,calc(100% - 192px));padding:16px 32px}\n"
    "}\n"
    "/* 750–1023: tek sırada ad sütunu 106px'e düşüyordu (768'de en uzun ad 10 satır, ölçüldü) → ad KENDİ sırasında\n"
    "   (görselin yanında tam genişlik), fiyat + Hemen al + Sepete ekle altında. Kapsül yüksekliği ~165 olunca köşe eğrisi\n"
    "   kargo satırı hizasında 34px içeri giriyor → yan boşluk 40 (4px ızgarası). */\n"
    "@media (min-width:750px) and (max-width:1023px){\n"
    "  sticky-add-to-cart[data-variant-available=\"true\"] .sticky-add-to-cart__bar{grid-template-areas:\"satir satir satir satir\" \"gorsel bilgi bilgi bilgi\" \"gorsel fiyat hemen sepet\";padding:16px 40px}\n"
    "  .sticky-add-to-cart__info{margin-bottom:8px}\n"
    "  .sticky-add-to-cart__price{align-self:center}\n"
    "}\n"
    "/* ≥1024: iki düğme eşit ve geniş (176 = 44 × 4); ad sütunu 1280'de 559px, 1024'te 303px kalır. */\n"
    "@media (min-width:1024px){\n"
    "  .sticky-add-to-cart__hemen,.sticky-add-to-cart__button{min-width:176px}\n"
    "}\n"
    "/* ≤749: düğmeler kendi sırasında yarı yarıya (Hemen al SOL · Sepete ekle SAĞ, sayfa içi çiftle aynı sıra — #995986).\n"
    "   Sütun 2 = %50 − 83 (65 görsel + 12 aralık + 6 yarım aralık): Hemen al (1+2) ile Sepete ekle (3) birebir eşit;\n"
    "   ad + fiyat 2–3'ü kaplar (390'da 289px, 320'de 219px). Sepete ekle yazısı geri gelir (tema ≤749'da gizliyordu;\n"
    "   artık yer var). Yükseklik 12 + 35 + 12 + 65 + 12 + 52 + 12 = 200 (390, ad iki satır). Eski ≤359 «görsel\n"
    "   çizilmez» kuralı kalktı: o kural fiyat sütunu 84px'e düştüğü için vardı, yeni düzende sütun 219px. */\n"
    "@media (max-width:749px){\n"
    "  sticky-add-to-cart[data-variant-available=\"true\"] .sticky-add-to-cart__bar{grid-template-columns:65px calc(50% - 83px) minmax(0,1fr);grid-template-areas:\"satir satir satir\" \"gorsel bilgi bilgi\" \"gorsel fiyat fiyat\" \"hemen hemen sepet\";column-gap:12px}\n"
    "  .sticky-add-to-cart__bar > .vks-satir{margin-bottom:12px !important}\n"
    "  .sticky-add-to-cart__hemen{padding:0 16px;font-size:14px;font-weight:700;border-radius:10px;margin-top:12px}\n"
    "  sticky-add-to-cart[data-variant-available=\"true\"] .sticky-add-to-cart__button{width:auto;margin-top:12px}\n"
    "  sticky-add-to-cart[data-variant-available=\"true\"] .sticky-add-to-cart__bar .add-to-cart-text__content{display:inline}\n"
    "}\n"
)
MOB_ESKI = ("   masaustu ETKILENMEZ. */\n"
            "@media (max-width: 749px) {\n"
            "  body:has(.sticky-add-to-cart__bar[data-stuck=\"true\"]) #wa-fab {\n"
            "    bottom: calc(200px + env(safe-area-inset-bottom, 0px)) !important;\n")
def mob_yeni(pay):
    return ("   masaustu ETKILENMEZ.\n"
            "   #996126 · ayse:888: serit uc siraya cikti (390'da 131 -> 200, ad iki satir) -> FAB payi\n"
            "   200 -> %d = 64 nav + 216 (ad uc satir) + 8 nefes. Olculdu (9 Kas, katalogdaki 492 ad, sabit\n"
            "   seritte): 390'da ad 1-3 satir 489 urun, 4 satir 3 urun; 320'de 4-5 satir 97 urun. 4+ satirda\n"
            "   FAB seridin ust kenarina 10-30px biner; o bolge kargo satirinin sagdaki 56px bos payi\n"
            "   (.vks-satir padding-right), dugmelere ve ada degmez (elementFromPoint: iki dugme de kendisi). */\n"
            "@media (max-width: 749px) {\n"
            "  body:has(.sticky-add-to-cart__bar[data-stuck=\"true\"]) #wa-fab {\n"
            "    bottom: calc(%dpx + env(safe-area-inset-bottom, 0px)) !important;\n") % (pay, pay)
def ciftler(pay=None):
    pay = FAB_PAY if pay is None else pay
    return {OVR: [(CSS_A, CSS_A_YENI), (CSS_B, CSS_B_YENI)], MOB: [(MOB_ESKI, mob_yeni(pay))]}
CIFTLER = ciftler()
def uygula(k, v):
    if k not in CIFTLER: raise SystemExit('bilinmeyen dosya ' + k)
    if '#996126' in v: raise SystemExit(f'DUR {k}: #996126 zaten uygulanmış')
    for e, y in CIFTLER[k]:
        n = v.count(e)
        if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi): {e[:60]!r}')
        v = v.replace(e, y)
    if v.count('{') != v.count('}'): raise SystemExit(f'DUR {k}: süslü parantez dengesi bozuk')
    return v
if __name__ == '__main__':
    import os, hashlib, json
    B = os.path.dirname(os.path.abspath(__file__)); m = lambda x: hashlib.md5(x.encode()).hexdigest(); md = {}
    os.makedirs(f'{B}/SONRASI', exist_ok=True)
    for k in SIRA:
        f = k.replace('/', '__'); o = open(f'{B}/ONCESI/{f}', encoding='utf-8').read(); s = uygula(k, o)
        open(f'{B}/SONRASI/{f}', 'w', encoding='utf-8').write(s); md[k] = {'once': m(o), 'sonra': m(s)}; print(k, m(o), '->', m(s))
    json.dump(md, open(f'{B}/md5.json', 'w'), ensure_ascii=False, indent=1)
