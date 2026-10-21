# #994771 — tema ÇEKİRDEĞİ 4px ızgara · CANLI BASIM KANITI (21 Eki 2026 16:09)
Tema 195348856964 (canlı) · Basan: ŞAH · dayanak: Mehmet 21 Eki 15:38 «tema çekirdeğini bozarsak geri alırız sen yap»

| dosya | ÖNCE (canlı = yedek) | SONRA (GET-back) |
|---|---|---|
| assets/base.css | 104121 B 836be812ac8d006608916214f0b9d5f6 | 104564 B e81946d17a97c7f3a55ea6d2eb5bdfea |
| assets/empire-overrides.css | 6778 B 5c28e19cde90e083b7a8bddb8c0dafe2 | 7773 B 1b6f63009e5db6eabab01c59414493d4 |
| assets/via-mobile-app.css | 35313 B 3cdbc3afd997058e1a67aa00dc10697d | 35445 B 2fa8cbf41797f29bf748d7ba33adebee |
| assets/via-product-overrides.css | 39414 B 31ba1e04914b17c10afdddaab6f693eb | 39924 B 1e71cd84577dea27e7a50be569c01260 |
| snippets/quantity-selector.liquid | 6583 B ee72c4eb95a104e44bbecb96dd757040 | 6623 B 0bbe6cd0d8cd52c00c0cffd24e2334a4 |
| snippets/sku.liquid | 701 B e2433b06046c76b5dcb2fbe15346e35e | 701 B cca5ae9e06517bf87f091e961b037a21 |
| snippets/predictive-search-products-list.liquid | 4279 B 0d5355e4a35379d861869db8b6d59cb7 | 4279 B 8fed0452962712ddf8a9824f18467aaf |
| snippets/predictive-search-styles.liquid | 20647 B 68fd97c483e11b5adb70b7d63254bc52 | 20795 B 80c75e61788729fc65480db3eb3350a2 |
| snippets/via-kargo-sayaci.liquid | 12129 B f964ec2831b044f24906cae26ff10ec0 | 12119 B fb5dd8cf78c014a9f36fdc969e5cf5e3 |
| templates/product.json | 27040 B 7ebb77c57b95e96f4ddaba841a366288 | 27040 B 7f31c1da41e072c8c6f88e6f7525ff2f |

Ölçüm (canlı, basım sonrası): ürün sayfası tema ihlali PC 53 -> 7 · mobil 67 -> 3 (kalanlar YALNIZ via-product-tabs, brif kısıtı).
Kategori/anasayfa/sepet/çok-al ürününde ihlal yalnız azaldı; lh · tıklanabilir · yazı<11 · taşma sabit; JS hata 0.

## ARIZA SINIFI — PUT sonrası okuma gecikmesi (ölçüldü)
PUT 200 + yanıttaki checksum YENİ, ama 1,2 sn sonraki GET ESKİ içeriği döndü; 2,6 sn'de yeni göründü.
GET-back tek okuma ile yapılırsa sahte "yazılmadı" alarmı üretir → ≤20 sn yoklama (bas.sh / geri.sh).

## GERİ ALMA (tek adım)
`bash olcum-yolu/ssm2.sh geri.sh` — sunucudaki basım-öncesi kopyaları (md5 = ~/asistan-yedek/994771-tema-cekirdek-20261021/CANLI-YEDEK__*)
geri yükler ve GET-back ile doğrular. Sunucu /tmp silinmişse yerel CANLI-YEDEK dosyaları kaynaktır.

## TEMA GÜNCELLEMESİ RİSKİ (kabul edilen)
base.css · quantity-selector · predictive-search-* · sku · empire-overrides tema dosyalarıdır; tema sürümü güncellenirse ya da
yeni tema kopyasına geçilirse bu değerler ezilir ve ihlaller GERİ GELİR. Geri dönüş: `yama.py` aynı eşleşmelerle yeniden
uygulanır (eşleşme 1 değilse DURUR — sessiz yanlış yama olmaz).
