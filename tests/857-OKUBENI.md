# #857 — sepet stok uyarısı · tarayıcı regresyon betikleri

Bu iki betik Shopify **temasını** ölçer (bu repo değil), Playwright ister.

```
node tests/857-dogrulama.mjs                 # canlı tema
node tests/857-dogrulama.mjs <preview_id>    # yayınlanmamış tema
node tests/857-regresyon.mjs  [preview_id]   # artır / azalt / sil bozulmamış mı
```

## Kök neden (15 Eyl 2026, tarayıcıda ölçüldü)
Sepet tıklamalarını `layout/theme.liquid` içindeki özel kod capture-phase'te
devralıyor; `component-cart-items.js` **hiç çalışmıyor** (`cart-items-disabled`
sınıfı hiç eklenmiyor). Bu yüzden oraya yazılan #573-1 stok-uyarısı düzeltmesi
etkisizdi.

`cartChange()` 422'de `applySections(d.sections)` çağırıyordu; `d.sections`
tanımsız olduğu için **sessizce hiçbir şey olmuyordu** — müşteri "+" basıyor,
bir şey değişmiyor, uyarı da çıkmıyor.

## Düzeltme
`theme.liquid` → `cartChange()` yanıtı `ok` bayrağıyla okuyor; `!ok || !sections`
ise uyarıyı `cartItemError-<line>` alanında gösteriyor, `/cart.js`'ten gerçek
adetleri geri yazıyor ve kuyruğu temizliyor (aynı geçersiz adet tekrarlanmasın).

Uygulanan dosyanın kopyası: `tema-yamalari/theme.liquid.857-sepet-stok-uyarisi`
Yedek (yama öncesi canlı): `~/Desktop/viamood/yedekler/theme.liquid.canli-857-oncesi-20260915`
