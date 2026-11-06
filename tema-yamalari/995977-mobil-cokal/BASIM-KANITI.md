# #995977 · ayse:858 iki ayak · basım kanıtı — 6 Kas 2026 03:14:33 TSİ (Elif)
- **Ayak 1 kökü:** `assets/via-mobile-app.css` satır 485–488. Kural `@media (max-width: 749px)` içinde (satır 28'de açılıyor):
  `.product-information, .product-page, [class*="product-information"] { padding-bottom: 112px !important }`.
  - `[class*=…]` 112px'i `.product-information__grid` ve `.product-information__media`'ya da veriyordu.
  - 390'da galeri altı → başlık arası 160px; başlık alt gezinme çubuğunun (y=780) altında kalıyordu.
  - Ana sayfa, koleksiyon ve sepette seçici 0 öğe yakalıyor (ölçüldü).
- **Ayak 2:** `templates/product.cok-al.json` satır 734, `equal_columns` false → true (ayse:858 hükmü; tek JSON yolu).
- **md5:**
  - `via-mobile-app.css` 2fa8cbf4 → dc417d95;
  - `product.cok-al.json` c1eb3f7f → 83c746ed (REST gövdesi).
  - Not: cok-al için REST gövdesi Shopify checksum'ından 8 bayt farklı biçimde dönüyor (734fe60f = GraphQL başlıksız içerik). JSON eşdeğer, ölçüldü.
- KURU ✓ → PUT 200 ×2 → GET-back ✓ ×2. Geri alma: `GERI=1 bash calistir.sh`.
- **Canlı ölçüm** (iki koşu birebir aynı):

  | Sayfa · genişlik | Başlık üst kenarı | Galeri altı → başlık |
  |---|---|---|
  | Ürün 132 · 390 | 792 → **680** | 160 → 48 |
  | Ürün 132 · 430 | 845 → **733** | 160 → 48 |
  | Çok-al · 390 | 607 → **495** | 160 → 48 |
  | Çok-al · 430 | 647 → **535** | 160 → 48 |

  - Bölümün kendi 112px alt boşluğu aynen duruyor.
  - **Çok-al · 1280:** sütunlar 800/400 → **600/600**, şerit 118/142 → **0/24**.
  - **Bozulmama:** varsayılan şablonda 4 ürün 1280'de 600/600, başlık 18px, taşma yok. 390 genişlikleri değişmedi.
