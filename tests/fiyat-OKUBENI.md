# İndirimli kartta eski fiyat taşması · ölçüm betikleri

```
node tests/fiyat-tasma.mjs 390 [preview_id]      # 4 koleksiyonda taşma taraması
node tests/fiyat-yukseklik.mjs [preview_id]      # kart yüksekliği tek mi
```

## Kusur (16 Eyl 2026, gerçek tarayıcı, 390px)
İndirimli üründe üzeri çizili eski fiyat kartın DIŞINA taşıyor, `.vkol2-card`
`overflow:hidden` olduğu için ortasından kırpılıyordu ("3.000,0…").

```
yeni fiyat 95.4px + margin 6px + eski fiyat 64.5px = 165.9px
kap genişliği 136px → karttan 16.8px, kaptan 29.8px taşma
4 koleksiyondaki 13 indirimli kartın 4'ünde
```

**Neden sarmıyordu:** iki `<span>` arasında boşluk karakteri yok (ayırıcı
`margin-left`), yani satır kırma fırsatı yok. `white-space` zaten `normal`.

## Düzeltme
Fiyat satırı `flex` + `wrap` → sığmayınca alt satıra iner.
Ek olarak **iki satırlık sabit yer** (`min-height:44px`) ayrılır.

⚠️ Yer ayırma şart: yalnız `wrap` eklediğimde indirimli kartlar ~19px uzadı ve
#855'te sağlanan tek-yükseklik bozuldu (ölçüldü: 363 vs 344.2). Yer ayrılınca
tüm kartlar yine tek yükseklikte (363).

`:has()` desteklenmezse kural uygulanmaz, bugünkü davranış kalır — regresyon yok.

## Sonuç (canlı, yama sonrası)
```
taşma            4/13 → 0/13
kart yüksekliği  tek değer (363) · fiyat satırı tek değer (44)
#855 hizası      bozulmadı (fiyat ofseti sayfa başına tek)
1280px           taşma 0 · başlık 3 satır · hiza tek
```
Yedek: `~/Desktop/viamood/yedekler/via-product-overrides.css.fiyat-oncesi-20260916`

## ⚠️ Ölçüm tuzağı — bayat CSS önbelleği

Tema CSS'i güncellendikten hemen sonra alınan tarayıcı ölçümü **eski CSS'i**
gösterebiliyor. 16 Eyl gecesi bu iki kez yanlış sonuca götürdü:

1. `min-height:44px` eklendi → ölçüm "uygulanmadı" dedi; birkaç dakika sonra
   aynı ölçüm `min-height: 44px` okudu (kural baştan beri doğruydu).
2. Sadece `flex-wrap` varken ölçüm "kart yükseklikleri 363 ve 344.2, tekdüzelik
   bozuldu" dedi; taze önbellekle tekrarlanınca **tek değer** çıktı.

**Kural:** tema asset'i yazdıktan sonra ölçümü en az bir kez TEKRARLA; iki ölçüm
aynı değeri vermeden hüküm verme. Doğrulama için asset'in `updated_at` damgası
`themes/<id>/assets.json?asset[key]=...` ile okunabilir.
