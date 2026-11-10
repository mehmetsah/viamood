# #996126 · ayse:888 (Yunus 7 Kas 12:13) — ürün sayfası SABİT SATIN ALMA ŞERİDİ, YALNIZ MASAÜSTÜ (≥750).
# Kapsam kararı: Yunus 9 Kas 11:20 (Viamood grubu, birebir) «Sadece Pc için değişikliği uygulayalım , mobil için ayrıca
# güncelleme vereceğim» → 10 Kas: telefon (≤749) davranışı canlıda BİREBİR aynı kalır.
# Yöntem (kanıtlanabilir olsun diye): mevcut şerit bloğu (ONCESI 557–581, ≤749 ve ≤359 dahil) BAYT BAYT KALIR; yama
# yalnız ≤359 bloğunun ARKASINA min-width:750 medya blokları EKLER. Hiçbir satır silinmez/değişmez — çivi bunu ölçer.
# Masaüstü (9 Kas önizlemesi, PR #44 ile aynı ölçüler): ad TAM (ellipsis yok) · görsel 52 → 65 (×1,25) · genişlik
# min(1440, %100 − 192) — 192 = iki yanda #wa-fab payı (20 kenar + 60 düğme + 16 nefes) · 750–1023 ad kendi sırasında ·
# ≥1024 düğmeler en az 176. via-mobile-app.css (WhatsApp payı 200 → 288, yalnız ≤749) bu kapsamla yamadan ÇIKTI.
# Hiyerarşi (ayse:730) AYNEN: Sepete ekle dolu birincil · Hemen al çerçeveli ikincil · WhatsApp şeride girmez.
# Yeni renk/jeton/yazı ölçüsü YOK: 65 = 52 × 1,25 (kayıt); 16/32/40 boşluklar 4px ızgarasında.

OVR = 'assets/via-product-overrides.css'
SIRA = [OVR]
CAPA = '@media (max-width:359px){\n  sticky-add-to-cart[data-variant-available="true"] .sticky-add-to-cart__bar{grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:"satir satir satir" "bilgi hemen sepet" "fiyat hemen sepet";column-gap:8px}\n  sticky-add-to-cart[data-variant-available="true"] .sticky-add-to-cart__image{display:none}\n}\n'
EK = (
    "/* ── #996126 · ayse:888 · YALNIZ MASAÜSTÜ (≥750) — Yunus 9 Kas 11:20: «Sadece Pc için değişikliği uygulayalım,\n"
    "   mobil için ayrıca güncelleme vereceğim». Yukarıdaki şerit kuralları (≤749 ve ≤359 dahil) AYNEN duruyor; aşağıdaki\n"
    "   kuralların HEPSİ min-width:750 içinde — telefonda hiçbir şey değişmez.\n"
    "   Ad TAM (ellipsis yok) · görsel 52 → 65 (×1,25) · genişlik = sayfa ızgarası (en çok 1440) ama sağ alttaki #wa-fab'a\n"
    "   İKİ YANDAN eşit pay (20 kenar + 60 düğme + 16 nefes = 96) → 1280'de 1088, 1440'ta 1248, 1920'de 1440 (ızgarayla\n"
    "   birebir). 16 + 18 + 16 + 65 + 16 = 131. Kapsül köşesi korunur; 32px yan boşluk köşe eğrisinin içinde kalır.\n"
    "   Hiyerarşi (ayse:730) AYNEN: Sepete ekle dolu · Hemen al çerçeveli · WhatsApp şeride GİRMEZ. */\n"
    "@media (min-width:750px){\n"
    "  sticky-add-to-cart[data-variant-available=\"true\"] .sticky-add-to-cart__bar{grid-template-columns:65px minmax(0,1fr) auto auto;width:min(1440px,calc(100% - 192px));padding:16px 32px}\n"
    "  .sticky-add-to-cart__bar > .vks-satir{margin-bottom:16px !important}\n"
    "  /* Görsel 65: tema `height:var(--height-buy-buttons)` (52) compiled_assets'te SONRA yükleniyor — seçici güçlendirildi. */\n"
    "  sticky-add-to-cart[data-variant-available=\"true\"] .sticky-add-to-cart__image{width:65px;height:65px}\n"
    "  /* Ad kesilmez: temanın `white-space:nowrap; text-overflow:ellipsis` kuralı ezilir. */\n"
    "  sticky-add-to-cart[data-variant-available=\"true\"] .sticky-add-to-cart__title{display:block;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:break-word}\n"
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
)
CIFTLER = {OVR: [(CAPA, CAPA + EK)]}
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
