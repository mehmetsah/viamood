# #996126 · ayse:888 — ürün sayfası sabit satın alma şeridi · YALNIZ MASAÜSTÜ (≥750) · DURUM: BASILDI (10 Kas 2026 11:11 TSİ)

Tema 195348856964 (canlı). Talep: Yunus (Viamood) 7 Kas 12:13 · kart #996126 · kayıt ayse:888 (aşama uygulama, veren ŞAH).
Kapsam kararı: Yunus 9 Kas 11:20 (Viamood grubu, birebir) «Sadece Pc için değişikliği uygulayalım , mobil için ayrıca
güncelleme vereceğim» → telefon (≤749) canlıda birebir aynı kalır. Yalnız CSS; Liquid'e dokunulmaz. Basan: ŞAH.

| dosya | ÖNCE (canlı = ONCESI) | SONRA (GET-back) | değişen |
|---|---|---|---|
| assets/via-product-overrides.css | 50622 B 69d89501771c3eed2f23008efe40044e | 2def0fa18e91166e67423b70096904d7 | ≤359 bloğunun arkasına 3 adet min-width ≥750 medya bloğu EKLENDİ; başka satır değişmedi |

Basım (`bash calistir.sh`, commit 61efc0d'den, 11:11:00–11:11:09 TSİ): ön kapı canlı = ONCESI ✓ · yama = SONRASI ✓ ·
PUT 200 · GET-back OK. Kuru koşu aynı turda iki kez geçti. CDN: `via-product-overrides.css?v=…1794298262` (11:11:02);
servis edilen dosya küçültülmüş (yorumsuz) hâl — `calc(100% - 192px)` kuralı içinde ölçüldü.
9 Kas sürümündeki `assets/via-mobile-app.css` (WhatsApp payı, yalnız ≤749) bu kapsamla yamadan ÇIKTI; canlıda dokunulmadı.

## Canlı ölçüm (Playwright, saat sabit 10 Kas 10:00, iki koşu birebir · ayrıntı raporlar/996126-kanit/10kas/)
| genişlik | önce | sonra |
|---|---|---|
| 1280 | şerit 600 × 113,5 · ad sütunu 183 (kesik) · görsel 52 · düğmeler 128 / 165 | şerit 1088 × 130,5 (x 96) · ad 559, tam · görsel 65 × 65 · düğmeler 176 / 176 |
| 390 | şerit 390 × 131,1 · ızgara 52 / 134 / 92 / 52 · WhatsApp bottom 200 | BİREBİR AYNI (4/4 ürün: kutu, ızgara, görsel, ad, düğmeler, WhatsApp) |
| 768 | şerit 600 × 113,5 | 576 × 145–184, ad tam (en uzun 3 satır), taşma yok, WhatsApp ∩ düğme 0 |
| 1440 | şerit 600 × 113,5 | 1248 × 130,5, ad tam, taşma yok, WhatsApp ∩ düğme 0 |

## GERİ ALMA
`GERI=1 bash tema-yamalari/996126-sabit-serit/calistir.sh` — canlı = SONRASI ise dosyayı ÖNCESİ'ne (69d89501) yazar.
