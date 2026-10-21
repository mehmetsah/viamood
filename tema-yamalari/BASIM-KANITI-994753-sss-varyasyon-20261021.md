# #994753 — SSS + yatay varyasyon CANLI BASIM · Meta Purchase HAZIRLIK (21 Eki 2026, ŞAH)

## 1. SSS (snippets/via-product-tabs.liquid) — CANLIDA
| | md5 |
|---|---|
| canli ONCE (=yedek) | 7841 B 5cfb8c081d9a94c8a0878b581eb58560 |
| canli SONRA (GET-back) | 10156 B d264b1720fff09070d479b6848fb2194 (= main 94ce2c2) |
Repo b8ee3bc'deki "CANLI-SSS-SONRASI" dosyasi canliya HIC basilmamisti (adi yaniltici);
bu basimla API yedegi + full-width duzeltmesi birlikte canliya girdi.
Canli olcum (PC1440+mobil430): SSS'li urunde 3. sekme "Sikca Sorulan Sorular" goruldu,
tiklaninca acildi, baska sekmeye gecince kapandi; diger urunler etkilenmedi; konsol hatasi 0.

## 2. Yatay varyasyon (blocks/via-cok-al.liquid) — BASILDI ve GERI ALINDI
Basim: 790f0c84 -> 95f5f97a. Canli ekran goruntusunde METIN CAKISMASI goruldu:
dar (171-191 px) kartta "1 ADET 30 LT" kelime kelime kiriliyor ve fiyatin USTUNE biniyor.
Taşma/scrollWidth olcumu bunu YAKALAMADI (ust uste binme, tasma degil).
Geri alma: 95f5f97a -> 790f0c84 (yedek, GET-back ile dogrulandi), canli olcum display:block geri geldi.
Sebep: yama yalniz izgara CSS'i; kart ic duzeni (yatay flex: radio|metin|fiyat) dar sutuna uyarlanmadi.
Bu bir YENI KART TASARIMI gerektiriyor (md.31) — bu turda uretilmedi.

## 3. Meta Purchase — HAZIR, CANLIYA BASILMADI
sections/via-order-success.liquid (canli 25482474...) -> yamali dbf222f6...
P1-C ile ayni kalip; eventID 'via-pur-<no>' + localStorage tekillestirme (cift ciro yok).
Civi tests/meta-purchase-tema.test.ts 7/7; mutasyon (tekillestirme kaldirildi) -> 2 kirmizi.
CAPI (sunucu tarafi) ENGELLI: sunucu env'de Meta token YOK; kasada aday Graph token var ama
ViaMood Pixel'ine bagli oldugu dogrulanamadi ve kasa kilitli (asistan acamaz, md.41).
