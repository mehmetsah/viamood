# #996126 · ayse:888 — ürün sayfası sabit satın alma şeridi · YALNIZ MASAÜSTÜ (≥750) · DURUM: BASILMADI

Tema 195348856964 (canlı). Talep: Yunus (Viamood) 7 Kas 12:13 · kart #996126 · kayıt ayse:888 (aşama uygulama, veren ŞAH).
Kapsam kararı: Yunus 9 Kas 11:20 (Viamood grubu, birebir) «Sadece Pc için değişikliği uygulayalım , mobil için ayrıca
güncelleme vereceğim» → telefon (≤749) canlıda birebir aynı kalır. Yalnız CSS; Liquid'e dokunulmaz.

| dosya | ÖNCE (canlı = ONCESI, 10 Kas yeniden çekildi) | SONRA | değişen |
|---|---|---|---|
| assets/via-product-overrides.css | 50622 B 69d89501771c3eed2f23008efe40044e | 2def0fa18e91166e67423b70096904d7 | ≤359 bloğunun arkasına 3 adet min-width ≥750 medya bloğu EKLENDİ; başka satır değişmedi |

9 Kas sürümündeki `assets/via-mobile-app.css` (WhatsApp payı 200 → 288, yalnız ≤749) bu kapsamla yamadan ÇIKTI.

## BASIM
`bash tema-yamalari/996126-sabit-serit/calistir.sh` (önce `KURU=1` ile kapılar) — canlı = ONCESI ve yama = SONRASI
olmadan PUT yapılmaz; GET-back md5 tutmazsa yazılan dosya ÖNCESİ'ne döner.

## GERİ ALMA
`GERI=1 bash tema-yamalari/996126-sabit-serit/calistir.sh` — canlı = SONRASI ise dosyayı ÖNCESİ'ne yazar.
