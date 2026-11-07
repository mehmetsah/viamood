# #995986 · ayse:863 KALEM 3 · basım kanıtı — 7 Kas 2026 09:08:11 TSİ (Elif)
- **Talep:** Yunus 6 Kas 08:05: «ne kadar kazancımız var ise … yeşil bir buton yapısı ile … "Kazancınız 250₺"».
  - Kayıt ve brif yeri «ürün adının ÜSTÜ» olarak belirtiyor; talepte «fiyat alanında … üstünde» geçiyor. Kayda uyuldu.
- **Yama:**
  - YENİ `blocks/via-kazanc.liquid`: tutar = compare_at − price (Liquid); indirim yoksa hiçbir şey basılmaz.
  - `product.json` 2f6b27d9 → 7ee2e9d9 ve `product.cok-al.json` 83c746ed → 4519432e: blok, block_order'da başlıktan önce.
  - Görsel dil `.vkr__rozet` ile aynı: #1C6B45 / #fff / 4px / 11px 600.
  - Para biçimi mağazanınki («TL»).
- KURU ✓ → PUT 200 ×3 → GET-back ✓ ×3. GERI şablonları geri alır; blok dosyası SİLİNMEZ (kullanılmaz kalır).
- **Canlı ölçüm** (iki koşu birebir aynı):

  | Ürün | 1280 | 390 |
  |---|---|---|
  | 132 (750 → 500) | «**Kazancınız 250TL**», başlığın üstünde (rozet altı 184 ≤ başlık üstü 200) | aynı |
  | indirimsiz | rozet yok | rozet yok |
  | çok varyantlı (indirimsiz) | rozet yok | rozet yok |

- **Varyant betiği** (sentetik `variant:update`): ekle → güncelle → kaldır → yeniden ekle, rozet her seferinde başlık bloğunun hemen önünde. Gerçek varyant değişiminde (indirimsiz) rozet çıkmıyor.
