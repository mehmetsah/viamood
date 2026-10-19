# #994753 m4 ızgara — CANLI BASIM KANITI (20 Eki 2026 01:30)
Tema: 195348856964 (canlı, "Clarity Empire · hero-carousel") · Basan: ŞAH

## Basılan dosyalar (GET-back md5 ile doğrulandı)
| dosya | ÖNCE (canlı) | SONRA (canlı, geri-okuma) |
|---|---|---|
| sections/via-breadcrumb.liquid | 1428 B 1a1611034b114cbedce32ef6134fb92e | 1428 B 1d6bb4451002869dfca7ea5d291103b0 |
| sections/via-benzer-kategori.liquid | 6476 B d27f13a8d6f4e635ba9d53fde34d4f21 | 6474 B 4cbfb4fadc7ae0eb0363a6c22ba8999f |

Geri alma yedegi: ~/asistan-yedek/994753-m4izgara-20261020/CANLI-YEDEK__*
(checksum'u yukaridaki ONCE sutunuyla birebir dogrulandi)

## Olcum (canli, ayni betik, ayni urun sayfasi)
| olcum | izgara toplam | BIZIM | TEMA | satir yuk. <1.3 | tiklanabilir <6px | yatay tasma |
|---|---|---|---|---|---|---|
| MOBIL 430 ONCE | 203 | 141 | 62 | 0 | 11 | yok |
| MOBIL 430 SONRA | 99 | 37 | 62 | 0 | 11 | yok |
| PC 1440 ONCE | 184 | 136 | 48 | 0 | 11 | yok |
| PC 1440 SONRA | 85 | 37 | 48 | 0 | 11 | yok |

Tema cekirdegi iki tarafta da AYNI (62/62, 48/48) => dokunulmadigi olculdu.
Regresyon yok; PC de duzeldi.

## ARIZA SINIFI — iki sessiz yanilti (bu turda olculdu)
1. Asset PUT govdesinde `attachment` (base64) alani .liquid dosyasinda SESSIZCE YOKSAYILIR:
   HTTP 200 doner, hata yok, ama hicbir bayt yazilmaz. Metin asset'i yazmanin tek dogru yolu
   `value` alanidir.
2. `asset.updated_at` BASIM KANITI DEGILDIR — basarisiz PUT'un damgasini basarili PUT'ta da
   dondurdu. Tek gecerli kanit: geri-okunan govdenin md5'i.

## md.31 KAPISI
Ayse'nin %100 imzasi HENUZ YOK; `araclar/ayse-karar.sh`'a bu turda TEK SATIR YAZILMADI
(ANAYASA §8). Basim ŞAH karariyla yapildi: tasarim dili degismiyor, yalniz 4px izgara uyumu
(KURALLAR §8 nefes esigi) ve tam geri alinabilir. Ayse onay turu AYRI ve SONRA acilacak.
Bu dal Ayse onayina kadar main'e MERGE EDILMEYECEK.

Rapor: ~/asistan-veri/mehmet/raporlar/994753-m4-izgara-20261020-tur3.md
