# #996126 · ayse:888 — ürün sayfası sabit satın alma şeridi · YALNIZ MASAÜSTÜ (≥750) · DURUM: BASILDI (iki basım)

Tema 195348856964 (canlı). Talep: Yunus (Viamood) 7 Kas 12:13 · kart #996126 / #996253 · kayıt ayse:888. Basan: ŞAH.
Kapsam: Yunus 9 Kas 11:20 «Sadece Pc için değişikliği uygulayalım , mobil için ayrıca güncelleme vereceğim» → telefon
(≤749) canlıda birebir aynı. Yalnız CSS, yalnız `assets/via-product-overrides.css`; Liquid'e ve via-mobile-app.css'e dokunulmadı.

| basım | zaman (TSİ) | md5 önce → sonra | commit | ne |
|---|---|---|---|---|
| 1 | 10 Kas 11:11:00–11:11:09 | 69d89501771c3eed2f23008efe40044e → 2def0fa18e91166e67423b70096904d7 | 61efc0d (PR #45) | masaüstü düzeni: ad tam, görsel 65, genişlik min(1440, %100 − 192) |
| 2 | 10 Kas 12:37:58–12:38:08 | 2def0fa18e91166e67423b70096904d7 → b528f2bbc1a697289f96dbccbcd3cc97 | 7122a79 (PR #46) | Ayşe RET %96 düzeltmesi: kapsül yarıçapı 750–1023 → 60px, ≥1024 → 65px |

Her basımda: ön kapı canlı = ONCESI ✓ · yama = SONRASI ✓ · PUT 200 · GET-back OK; öncesinde KURU koşu geçti.
CDN küçültülmüş dosya servis eder (md5 Asset API'yle tutmaz); yeni kural içerikte ölçüldü (`padding:16px 40px;border-radius:60px`, v=…1794303480).

## Basım 2 — yarıçap (canlı ölçüm, iki koşu birebir, önizlemeyle birebir)
Köşe payı = şerit köşe eğrisine kalan px (araç raporlar/996126-kanit/arac/pay.cjs). 492 ad + 16 varyantlı ürün (2 varyantlıda
şerit çizilmiyor: biri stokta yok, biri çok-al şablonu).
| genişlik | yarıçap | kargo kamyonu (çizim) en düşük | «Sepete ekle» (kutu) en düşük | 11'in altı |
|---|---|---|---|---|
| 750 · 768 · 900 · 1023 | 60 | 17,6 | 11,7 | 0 |
| 1024 · 1280 · 1440 · 1920 | 65 | 11,6 | 11,2 | 0 |
Önce (2def0fa1): 750'de 15 ad, 768'de 7 ad eğriye değiyordu (< 0).
750–1023 için Ayşe 72px yazmıştı; 72'de «Sepete ekle» 7,5 px kalıyor (ölçüt ≥11) → 60px [ŞAH kararı, gerekçe PR #46].
390: basım öncesiyle 4/4 ürün birebir (şerit, ızgara, görsel, ad, düğmeler, WhatsApp).

## GERİ ALMA
- Yalnız yarıçap: `GERI=1 bash tema-yamalari/996126-sabit-serit/calistir.sh` → 2def0fa1.
- Masaüstü değişikliğinin tamamı: önce yukarıdaki komut, sonra 61efc0d'deki paketle
  (`git show 61efc0d:tema-yamalari/996126-sabit-serit/...` ONCESI/SONRASI/md5.json) `GERI=1` → 69d89501.
