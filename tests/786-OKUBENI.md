# #786 madde 2 — arama modalı "Son görüntülenenler" · ÖLÇÜM SONUCU

Bu madde 10 Eyl'den beri "⚪ ölçülemedi (tarayıcı gerekiyor)" olarak duruyordu.
16 Eyl 2026'da gerçek tarayıcıda ölçüldü.

```
node tests/786-arama-modali.mjs 390
node tests/786-popup-cakismasi.mjs 390
```

## 1) Madde 2 ÜRETİLEMİYOR — blok artık yok

Arama modalı 390px'te açıldı ve içeriği ölçüldü:
```
modal açık                 : EVET
"Son görüntülenenler"      : YOK  (metin sayfada hiç geçmiyor)
görünen bölümler           : "Popüler Aramalar" · "Kategoriler"
bağlantı yazı boyutu       : 14px (tek değer — tutarsızlık yok)
```
Şikâyetin konusu olan blok modalda **bulunmuyor**; yerini "Popüler Aramalar"
almış. Görsel/yazı boyutu tutarsızlığı bu hâliyle üretilemiyor.

## 2) YENİ BULGU — kampanya pop-up'ı aramayı kapatıyor (ayrı kart)

```
vmk-overlay vmk-acik   z-index: 99999     ← kampanya pop-up'ı
vm-search              z-index:   998     ← arama paneli
pop-up açıkken arama düğmesi tıklandı → modal AÇILMADI (overlay engelliyor)
```
Sayfada ~15 sn durduktan sonra pop-up çıkıyor ve arama erişilemez hâle geliyor;
kullanıcı arama açıkken pop-up gelirse de üstünü örtüyor (ekran görüntüsü:
`/tmp/786-arama-390.png`).

Bu bir **davranış kararı** — pop-up başka bir modal açıkken bastırılsın mı, yoksa
z-index sırası mı değişsin? Kendi başıma değiştirmedim, ayrı kart açılmalı.
