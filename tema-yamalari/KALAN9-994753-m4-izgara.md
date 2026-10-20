# #994753 m4 izgara — KALAN 9 IHLAL (kaynak + olcum turu, CANLIYA BASILMADI)
ŞAH · 20 Eki 2026 · dal kod/994753-m4-kalan9 · taban main 303b87f

## 9 IHLALIN KIMLIGI (olcumle, tahminle degil) — PC 1440 ve mobil 430'da BIREBIR AYNI
| # | oge | ozellik | mevcut | hedef | KAZANAN KURALIN KAYNAGI (CDP ile olculdu) |
|---|---|---|---|---|---|
| 1-2 | `div.vks-satir` | row-gap · column-gap | 6px | **8px** | `snippets/via-kargo-sayaci.liquid` `.vks-satir{gap:6px}` — BIZIM |
| 3 | `p.vuy-empty` | margin-top | 14px | **16px** | kural YOK ⇒ tarayici `<p>` varsayilani (margin-block:1em x font-size 14px) |
| 4-7 | `button.vuy-modal-close` | padding 4 yon | 1px/6px | **8px** | kural YOK ⇒ tarayici `button` varsayilani (1px 6px) |
| 8-9 | `button.vuy-btn-solid` | padding-top · padding-bottom | 14px | **16px** | `empire-overrides.css` `.button,.btn,button[type=submit]...{padding:14px 28px!important}` — TEMA CEKIRDEGI |

## KARARLAR (her biri ayri, gerekceli)
1. **vks-satir gap 6->8: DUZELT.** Bizim snippet, tek satirlik degisiklik, yan etki yok.
2. **vuy-empty margin: DUZELT**, acik `margin:16px 0 0` yazildi. Tarayici varsayilanini ezmek
   standart; ihlal bizim ogede gorundugu icin sorumluluk bizde.
3. **vuy-modal-close: DUZELT ama hedef 4px DEGIL 8px.** 4px izgaraya oturur fakat NEFES ESIGI
   "tiklanabilir dikey ic bosluk >=6px" der; 4px onu ihlal ederdi. 8px ikisini de karsilar.
   Hedef degerden bilerek sapildi, gerekcesi budur.
4. **vuy-btn-solid: DUZELT, ama TEMA CEKIRDEGINE DOKUNMADAN.** `empire-overrides.css`
   kapsam disi (#994771). Bizim tarafta DAR ve ozgul kural yazildi:
   `.vuy-btn-solid{...;padding:16px 28px!important}` — yalniz bu dugme etkilenir.
   Yatay 28px zaten izgarada (4x7), yalnizca dikey 14->16 degisti.
   `!important` zorunlu: tema kurali da !important ile dayatiyor.
5. **DOKUNULMAYAN:** `.vuy-modal-close{top:12px;right:14px}` — `right:14px` izgara disi ama
   olcum kapsaminda DEGIL (konum, bosluk degil) ve degistirmek dugmeyi 2px kaydirirdi.
   Bilerek birakildi.

## OLCUM — canliya BASILMADAN (yamali CSS ayni DOM'a enjekte edilerek)
| viewport | taranan | BIZIM ONCE -> SONRA | TEMA ONCE -> SONRA | satir yuk.<1.3 | tiklanabilir<6px | yatay tasma |
|---|---|---|---|---|---|---|
| PC 1440 | 493 sabit | **9 -> 0** | 53 -> 53 | 0 -> 0 | 11 -> 11 | yok |
| mobil 430 | 491 sabit | **9 -> 0** | 67 -> 67 | 0 -> 0 | 11 -> 11 | yok |
Enjeksiyon teyidi (iki viewport'ta da): vks gap 8px · vuy-empty margin-top 16px ·
modal-close padding-top 8px · btn-solid padding-top 16px.

## DOSYA CIPALARI
| dosya | canli (ONCE) | yamali (SONRA) |
|---|---|---|
| snippets/via-kargo-sayaci.liquid | 12129 B 5f750645f92e6c6a9f445dcac9473032 | 12129 B f964ec2831b0... |
| sections/via-urun-yorumlar.liquid | 13496 B f698c842bc0c249ba6132fb812fbc57f | 13552 B e1620b0c74ca... |
Yedek: ~/asistan-yedek/994753-kalan9-20261020/CANLI-YEDEK__*

⛔ CANLIYA BASILMADI — bu tur kaynak + olcum turudur, basim ayri adim ve Mehmet'in
gorsel onayina baglidir. md.31: SAH imzasi var, AYSE imzasi EKSIK (ayri tek tur).
