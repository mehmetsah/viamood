# #994753 — SSS sekmesi mobil etiket (Ayse ret gerekcesi ayse:719, oneri B) — CANLIDA (21 Eki 2026, SAH)

snippets/via-product-tabs.liquid: canli d264b1720fff09070d479b6848fb2194 (10156 B)
  -> 6092caea718ad07259f3338bb8182def (11108 B), GET-back ilk denemede eslesti (16:22:57).
Yedek: ~/asistan-yedek/994753-sssmob-20261021/CANLI-YEDEK__via-product-tabs.liquid

Degisiklik (yalniz SSS sekme DUGMESI; icerik basligi ayni):
- CSS: dosyanin KENDI mobil kirilimi (600px) — .vp-tab__kisa gizli; <=600px'te uzun gizli, kisa gorunur
- JS: tek yardimci sssEtiket(btn) — iki span (uzun "Sikca Sorulan Sorular" / kisa "SSS"), aria-label tam ad
- iki yol da (API yolu + sekmelestirme dongusu) ayni yardimciyi cagirir
- capture dinleyicisi e.target yerine e.target.closest('.vp-tab') — dugme artik ic span tasidigi icin

Canli olcum (gercek kod, enjeksiyon yok):
| genislik | satir | aktif cizgi hatta | SSS tikla/geri | js hata |
| PC 1440 | 1 | evet (tam ad 195px) | acik/kapali | 0 |
| mobil 430 | 2 -> 1 | hayir -> EVET ("SSS" 57px) | acik/kapali | 0 |
| mobil 375 | 2 -> 1 | hayir -> EVET | acik/kapali | 0 |
| mobil 360 | 2 -> 2 | hayir -> hayir (SINIR) | acik/kapali | 0 |
2 sekmeli urun etkilenmedi (PC + mobil 1 satir).

ACIK: 360 px ve alti. Olculmus ek secenekler (<=374px, B'ye ek; Ayse karari):
 C) sekme yatay dolgu 12px -> 360'ta 1 satir, cizgi hatta, kesik yok; 320'de hala 2 satir
 D) nowrap + overflow-x:auto -> 360 ve 320'de 1 satir, cizgi hatta, ama SSS kesik (Ayse A'yi bu yuzden istememisti)
