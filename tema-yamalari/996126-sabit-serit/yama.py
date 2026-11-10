# #996126 · ayse:888 — ürün sayfası SABİT SATIN ALMA ŞERİDİ, YALNIZ MASAÜSTÜ (≥750).
# Geçmiş: 9 Kas önizleme (2f8dad8, revert 9be3546) → 10 Kas 11:11 masaüstü basımı (61efc0d: 69d89501 → 2def0fa1,
#   Yunus 9 Kas 11:20 «Sadece Pc için») → BU TUR: Ayşe RET %96 (10 Kas 12:03) düzeltmesi.
# RET'in kök nedeni (Ayşe ölçtü): tema şeride `border-radius:112px` veriyor → etkin yarıçap = yükseklik/2. Ad 2–3 satıra
#   inince (ya da varyant satırı olunca) şerit uzuyor, uçlar büyüyor; yatay iç boşluk (32/40) sabit kaldığı için köşedeki
#   kargo kamyoneti ve «Sepete ekle» eğriye değiyor: 768'de −0,3 / −1,7 px; 1024'te 3 satırlı adlarda kamyon 5,2–6,4 px.
# Düzeltme: yarıçap SABİT — ≥1024: 65px (Ayşe'nin yazdığı; tek satırlı şerit 130,5 zaten 65,25 yarıçaplıydı, görünüm aynı).
#   750–1023: 60px [ŞAH KARARI · 10 Kas]. Ayşe 72px yazdı, ama bu bantta yarıçap sabitlenince köşe geometrisi addan bağımsız
#   ve 72px'te «Sepete ekle» köşesi eğriye 7,5 px (kutu) / 8,9 px (düğmenin 4px yuvarlağıyla) kalıyor — kabul ölçütü ≥11.
#   Ölçüldü (önizleme, 492 ad + 16 varyantlı): 64 → 10,3 · 62 → 11,0 · 60 → 11,7 (kutu); 60 kargo kamyonunda 17,6 (çizim).
#   60 = ölçütü üç yöntemin hepsinde geçen, 4px ızgarasındaki en büyük değer. YALNIZ bu iki değer eklenir; ≤749 değişmez.
# Telefon (≤749) değişmez: ONCESI/SONRASI'dan #996126 masaüstü bölümü çıkarılınca kalan dosya 9 Kas öncesi canlının
#   (69d89501) birebir aynısıdır — çivi bunu md5 ile ölçer.

OVR = 'assets/via-product-overrides.css'
SIRA = [OVR]
ILK_CANLI = '69d89501771c3eed2f23008efe40044e'  # #996126 masaüstü bölümünden ÖNCEKİ canlı (telefon bu hâlde kalır)
A = '@media (min-width:750px) and (max-width:1023px){\n  sticky-add-to-cart[data-variant-available="true"] .sticky-add-to-cart__bar{grid-template-areas:"satir satir satir satir" "gorsel bilgi bilgi bilgi" "gorsel fiyat hemen sepet";padding:16px 40px}\n'
A_YENI = (
    "/* #996126 · ayse:888 RET (Ayşe %96, 10 Kas 12:03) — kapsül yarıçapı SABİT. Tema 112px etkin yarıçapı yüksekliğin\n"
    "   yarısına eşitliyordu; ad 2–3 satıra inince uçlar büyüyor, yan boşluk sabit kaldığı için köşedeki kargo kamyoneti ve\n"
    "   «Sepete ekle» eğriye değiyordu (768'de −0,3 / −1,7 px). ≥1024: 65px (tek satırlı şerit 130,5 → yarısı 65,25:\n"
    "   görünüm aynı). 750–1023: 60px — 72'de «Sepete ekle» köşesi 7,5 px kalıyordu; 60 kamyonda 17,6 / düğmede 11,7. */\n"
    + A[:-2] + ";border-radius:60px}\n"
)
B = '@media (min-width:1024px){\n  .sticky-add-to-cart__hemen,.sticky-add-to-cart__button{min-width:176px}\n}\n'
B_YENI = (
    "@media (min-width:1024px){\n"
    "  sticky-add-to-cart[data-variant-available=\"true\"] .sticky-add-to-cart__bar{border-radius:65px}\n"
    "  .sticky-add-to-cart__hemen,.sticky-add-to-cart__button{min-width:176px}\n"
    "}\n"
)
CIFTLER = {OVR: [(A, A_YENI), (B, B_YENI)]}
def uygula(k, v):
    if k not in CIFTLER: raise SystemExit('bilinmeyen dosya ' + k)
    if 'ayse:888 RET' in v: raise SystemExit(f'DUR {k}: #996126 yarıçap düzeltmesi zaten uygulanmış')
    for e, y in CIFTLER[k]:
        n = v.count(e)
        if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi): {e[:60]!r}')
        v = v.replace(e, y)
    if v.count('{') != v.count('}'): raise SystemExit(f'DUR {k}: süslü parantez dengesi bozuk')
    return v
if __name__ == '__main__':
    import os, hashlib, json
    B_ = os.path.dirname(os.path.abspath(__file__)); m = lambda x: hashlib.md5(x.encode()).hexdigest(); md = {}
    os.makedirs(f'{B_}/SONRASI', exist_ok=True)
    for k in SIRA:
        f = k.replace('/', '__'); o = open(f'{B_}/ONCESI/{f}', encoding='utf-8').read(); s = uygula(k, o)
        open(f'{B_}/SONRASI/{f}', 'w', encoding='utf-8').write(s); md[k] = {'once': m(o), 'sonra': m(s)}; print(k, m(o), '->', m(s))
    json.dump(md, open(f'{B_}/md5.json', 'w'), ensure_ascii=False, indent=1)
