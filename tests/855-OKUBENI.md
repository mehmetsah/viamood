# #855 — ürün kartı hizası · tarayıcı ölçüm betikleri

Shopify **temasını** ölçer (bu repo değil), Playwright ister.

```
node tests/855-baslik.mjs 390                  # canlı tema, 390px
node tests/855-baslik.mjs 390 <preview_id>     # yayınlanmamış tema
node tests/855-regresyon.mjs [preview_id] 390  # 4 sayfada fiyat hizası tek mi
```

## Kök neden (16 Eyl 2026, gerçek tarayıcı)

⚠️ Önceki turlarda **yanlış bileşeni** ölçmüştüm. Koleksiyon ızgarası native
`resource-card` DEĞİL, özel `article.vkol2-card` kullanıyor. `via-product-overrides.css`
içindeki 3-satır kırpma kuralı yalnız `.resource-card__title`'a yazılmıştı, yani
koleksiyon kartlarına hiç uygulanmıyordu.

`.vkol2-title` ölçümü (yama öncesi):
```
line-clamp: none · min-height 36px (mobil) / 44px (masaüstü)
başlık 2–6 satır arasında değişiyor → fiyat satırı kayıyor:
  390px : 289.3 → 358.6   (69px)
  768px : 373.0 → 437.8   (65px)
  1280px: 499.3 → 520.5   (21px)
```
İki sütunlu ızgarada komşu kartların fiyatları farklı yükseklikte duruyordu —
"hizalar bozuk" şikâyeti birebir bu.

## Düzeltme
`.vkol2-card .vkol2-title` → 3 satıra kırpılır, `min-height` 3 satıra eşitlenir.
Tema zaten `.resource-card__title`'da aynı deseni kullanıyor; kural oraya hizalandı.

Sonuç (canlı, yama sonrası): üç genişlikte de başlık yüksekliği, fiyat ofseti ve
kart yüksekliği **tek değer**. `vkol2-card` yalnız koleksiyon sayfalarında var;
anasayfa ve arama etkilenmiyor (ölçüldü).

Uygulanan dosya: `tema-yamalari/via-product-overrides.css.855-kart-hizasi`
Yedek (yama öncesi): `~/Desktop/viamood/yedekler/via-product-overrides.css.855-oncesi-20260916`

## Yan bulgu (AYRI iş)
İndirimli üründe üzeri çizili karşılaştırma fiyatı kart kenarından taşıyor
("3.000,0…" diye kesiliyor). Yama ÖNCESİ ekran görüntüsünde de var — bu
değişiklikten bağımsız, ayrı kart açılmalı.
