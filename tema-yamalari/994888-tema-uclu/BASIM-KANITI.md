# #994888 — ViaMood tema üçlüsü · CANLI BASIM KANITI (22 Eki 2026 13:57 TSİ)
Tema 195348856964 (canlı, "Clarity Empire · hero-carousel") · Basan: ŞAH · yol: SSM → sunucu → Admin Asset API
Ön kapı: 3 mevcut dosyada canlı md5 = ONCESI (yedek) ✓ · yeni snippet 404 ✓ · sunucuda üretilen yama md5 = yerel SONRASI ✓

| dosya | ÖNCE (canlı = yedek) | SONRA (GET-back) | kalem |
|---|---|---|---|
| snippets/via-politika-baslik.liquid | — (yeni) | 2380 B e02f40a457650550bc8d5c6672d120da | m2 |
| assets/via-product-overrides.css | 39924 B 1e71cd84577dea27e7a50be569c01260 | 41951 B 80f9a0587c89819ddbe02d929ef2c8d7 | m2 |
| layout/theme.liquid | 33384 B 717d6590d2350133f812fe97788ae597 | 33661 B 3902f4884c83fbbdd75d7190ce422961 | m2 |
| templates/product.json | 27040 B 7f31c1da41e072c8c6f88e6f7525ff2f | 27520 B 51343646fd65b43e985fc483ec708bc3 | m8 |

## Canlı ölçüm (basım sonrası, Playwright, kanıt: ~/asistan-veri/mehmet/raporlar/994888-kanit/)
- m2 /policies/privacy-policy 1440+430: "YASAL · VİA MOOD" + "Son güncelleme: Ekim 2026 · VIA GLOBAL DIŞ TİCARET LİMİTED ŞİRKETİ";
  panel içi "Son Güncelleme: 13 Ekim 2026" satırı YOK. Göz başlığı/başlık/tarih/kart konum+tipografi iade sayfasıyla eşit
  (PC: y 165/195/279/335 iki sayfada aynı · h1 54.4px lh 1.32). Ana sayfa/ürün/koleksiyon/sepet/iade/çok-al 200, "Liquid error" 0.
- m8 templates/product.json → yerleşik variant-picker (buttons) fiyat bloğundan sonra. Gerçek 3 varyantlı ürün
  (30-lt, `?view=<olmayan>` ile canlı product.json'a düşürülerek) 1440/430/375: kutucuklar yatay, taşma 0, 46px, 14px,
  tıklama + klavye ok tuşu → form id doğru variant'a geçiyor. Tek varyantlı üründe seçici 0, düzen bayt-yükseklik aynı
  (PC 1047 / mobil 774). Çok-al ürünü (product.cok-al.json) DEĞİŞMEDİ: 3 vqb kartı, seçim çalışıyor.
- Geçici önizleme şablonu templates/product.m8-onizleme.json ölçüm için yazıldı ve AYNI TURDA silindi (Admin 404, varlık listesinde yok).

## GERİ ALMA (tek adım)
`bash ~/asistan-veri/mehmet/raporlar/994771-tema-cekirdek/ssm2.sh tema-yamalari/994888-tema-uclu/geri.sh`
— sunucudaki basım-öncesi kopyaları (/tmp/g994888-bas/ONCESI, md5 = ONCESI/) geri yazar, snippet'i siler, GET-back ile doğrular.
Sunucu /tmp silinmişse kaynak bu dizindeki ONCESI/ dosyalarıdır.

## TEMA GÜNCELLEMESİ RİSKİ
layout/theme.liquid ve templates/product.json tema dosyalarıdır; tema kopyası değişirse `python3 yama.py` aynı eşleşmelerle
yeniden uygulanır (eşleşme 1 değilse DURUR).
