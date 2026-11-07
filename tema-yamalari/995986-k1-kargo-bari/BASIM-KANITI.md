# #995986 · ayse:863 KALEM 1 · basım kanıtı — 7 Kas 2026 09:07:41 TSİ (Elif)
- **Talep:** Yunus 6 Kas 08:05: «Sayaç olduğu için, 24 saat içinde kargoda bar'ını kaldıralım».
- **Kaynak:** bar, `templates/product.json` › product-details › `vm_rozetler` grubunun 2. rozeti (`vm_rozet_2`, ikon + metin).
- **Yama:** `vm_rozet_2` → `"disabled": true` (tek satır). Shopify devre dışı bloğu HİÇ render etmez; bu CSS ile gizleme değil.
  - Çok-al şablonunda bu bar yok (ölçüldü).
- md5 5ab2187b → 2f6b27d9. KURU ✓ → PUT 200 → GET-back ✓. Geri alma: `GERI=1 bash calistir.sh`; K3'ten SONRA geri alınacaksa önce K3 geri alınır.
- **Canlı ölçüm** (indirimli · indirimsiz · çok varyantlı; 1280 + 390; iki koşu birebir aynı):
  - «24 saat içinde kargoda» görünür 1 → **0**; DOM'da da yok (basılmıyor).
  - Sayaç duruyor.
  - Öteki üç rozet (Kargo Ücretsiz · 14 gün koşulsuz iade · Kapıda Ödeme) duruyor.
