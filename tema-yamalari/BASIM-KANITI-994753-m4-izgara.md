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

## IKINCI BASIM — sections/via-urun-yorumlar.liquid (vuy-* grubu)
| asama | md5 |
|---|---|
| canli ONCE | 13496 B 17a50bd93ab1322c6acb4e36f77bb99b |
| yamali / canli SONRA (GET-back) | 13496 B f698c842bc0c249ba6132fb812fbc57f |

11 bildirim 4px izgarasina oturtuldu (her desen tam 1 kez):
gap 14->16 · padding-top 26->24 · margin-bottom 18->16 · padding 9px 18px->8px 16px ·
padding 18px 18px->16px 16px · gap 9->8 · padding 30->32 · gap 11->12 ·
padding 11px 13px->12px 12px (yorum formu input/textarea) · gap 5->4 · margin 6px 0 2px->8px 0 4px
Dosyada kalan izgara disi deger: 0. Liquid etiket sayimi yedekle birebir ayni.

## OLCUM (canli, uc asama)
| olcum | toplam | BIZIM | TEMA | lh<1.3 | tik<6px | tasma | taranan |
|---|---|---|---|---|---|---|---|
| MOBIL 430 tur basi | 203 | 141 | 62 | 0 | 11 | yok | - |
| MOBIL 430 1.basim | 99 | 37 | 62 | 0 | 11 | yok | 466 |
| MOBIL 430 2.basim | 76 | 9 | 67 | 0 | 11 | yok | 490 |
| PC 1440 tur basi | 184 | 136 | 48 | 0 | 11 | yok | - |
| PC 1440 1.basim | 85 | 37 | 48 | 0 | 11 | yok | 468 |
| PC 1440 2.basim | 62 | 9 | 53 | 0 | 11 | yok | 492 |

BIZIM izgara ihlali: mobil 141->9, PC 136->9. Regresyon yok.
DURUST NOT: tema sutunu +5 artti ama 24 ogle daha tarandi (DOM farki); yamada tema
selector'u YOK, yine de ayni DOM uzerinde A/B izolasyonu YAPILMADI => "olculmedi" (md.52).

Geri alma: ~/asistan-yedek/994753-m4izgara-20261020/CANLI-YEDEK__via-urun-yorumlar.liquid
