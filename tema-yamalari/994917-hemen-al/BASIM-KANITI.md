# #994917 — ViaMood m7+m8 · Hemen al + ürüne özel WhatsApp · CANLI BASIM KANITI (22 Eki 2026 22:08–22:10 TSİ)
Tema 195348856964 (canlı) · Basan: ŞAH · yol: SSM → sunucu → Admin Asset API · karar: ayse:730 (md.31 ŞAH %100 21:33 + Ayşe %100 21:39, ölçüm nesnesi r4-capalar.py md5 0138dc44…)
Ön kapı: 6 mevcut dosyada canlı md5 = ONCESI ✓ · yeni snippet 404 ✓ · sunucu yaması md5 = yerel SONRASI 7/7 ✓ (kuru koşu + gerçek basım)

| dosya | ÖNCE (canlı = yedek) | SONRA (GET-back) | kalem |
|---|---|---|---|
| snippets/via-satinal-ek.liquid | — (yeni) | 11675 B 5bb6a47d6bf5d50070b21137914a8ead | §5.1 |
| assets/via-product-overrides.css | 41951 B 80f9a0587c89819ddbe02d929ef2c8d7 | 46492 B 08dd5a2eccc843239815c05767d1027c | §5.4 (r3 CSS 4978434f sona) |
| sections/product-information.liquid | 14099 B 718ba71b255dbcd3d193064a883bb5eb | 14348 B b6bb7d59d6c8f30eb8eacb89ac6a1f62 | §5.3 |
| blocks/buy-buttons.liquid | 16991 B 6e58e4b81daac41bfe34e1b5c1fc9883 | 17127 B ab34b8f6dd63060a295ff838272e8af7 | §5.2 |
| blocks/via-cok-al.liquid | 9914 B 790f0c841dcbb4b22971632e750d0414 | 9978 B 827111b1553fd160d28a3c434bccc88e | §5.6 |
| sections/whatsapp-sticky.liquid | 19813 B 59edbe98479e4029d65472584ef6144f | 19932 B 0c770c4246e58a385fbd9171ca63f6d9 | §5.5a + 3c (2 emoji) |
| sections/footer-group.json | 2170 B a334e6fc7d625a8dc264fb6be041194f | 2197 B edd0dffcf1827a004e951b5c5950b355 | §5.5b |

Canlı ölçüm: ~/asistan-veri/mehmet/raporlar/994917-uygulama-20261022.md (77 geometri ölçümü kırmızı 0 · davranış 7/7).

## GERİ ALMA (tek adım, kendi kendine yeten — ÖNCESİ dosyaları paketin içinde)
`bash ~/asistan-veri/mehmet/raporlar/994771-tema-cekirdek/ssm2.sh tema-yamalari/994917-hemen-al/geri.sh`
Render eden 6 dosyayı ÖNCESİ'ne döndürür (GET-back md5 doğrular), snippet'i EN SON siler.
⚠ Shopify DELETE olmayan dosyada da `200 {}` döner — silme kanıtı GET 404'tür.

## TEMA GÜNCELLEMESİ RİSKİ
`python3 yama.py ONCESI SONRASI` aynı çapalarla yeniden uygulanır; her çapa TAM 1 eşleşmezse DURUR.
