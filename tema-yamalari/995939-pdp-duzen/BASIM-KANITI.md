# #995939 · ayse:858 · basım kanıtı — 6 Kas 2026 02:15:15 TSİ (Elif)
- Talep: Yunus 5 Kas 12:22 ekran görüntüsü (ürün 132; görselin iki yanında boş şeritler). Kayıt ayse:858 (aşama: uygulama).
- **Kök (ölçüldü, 1280px):**
  - Izgara `800px 400px`. Tema `styles.css` ≥1200px kuralı «2fr 1fr»; `equal_columns: false` olduğu için `--half` sınıfı yok.
  - `via-product-overrides.css` 1. satır `media-gallery{max-width:540px!important;margin-inline:auto!important}` galeriyi 800px kolonda 540px'e kısıyor.
  - Sonuç: kolon kenarından galeriye sol 118px, sağ 142px boşluk.
- **Yama** (iki dosya; CSS önce, şablon sonra yazıldı):

  | Dosya | md5 önce → sonra | Değişiklik |
  |---|---|---|
  | `templates/product.json` | cf7c0cf0 → 5ab2187b | `main.settings.equal_columns` false → true (tek JSON yolu; #995932 başlık ön ayarı h5 aynen) |
  | `assets/via-product-overrides.css` | 0d5fc0a3 → 965806de | yalnız EKLEME: `≥761px .product-information__grid--half` içinde galeri `max-width: none !important` |

  - 1. satırdaki 540px ortak kural değişmedi.
  - KURU kapı ✓ → PUT 200 ×2 → GET-back ✓ ×2. Geri alma: `GERI=1 bash calistir.sh`.
- **Canlı ölçüm**, ürün 132, enjeksiyonsuz, iki koşu birebir aynı:

  | Ölçüm | Önce | Sonra |
  |---|---|---|
  | Sütunlar | 800 / 400 | **600 / 600** |
  | Galeri ↔ kolon kenarı (sol / sağ) | 118 / 142 | **0 / 24** |

  - Sağdaki 24px, temanın 48px kolon aralığının yarısı.
  - Görsel kutusu 540 → 576.
  - Fotoğraf 2:3, çerçeve 3:4 (`object-fit: contain`); çerçeve içinde 32px iç boşluk kalıyor. Bu fotoğrafa bağlı: tek görselli kontrol ürününde 0.
  - Sağ sütun blok aralığı 16px tek ölçek (önce de 16).
  - Başlık 18px (değişmedi).
  - 390px: hiçbir değer değişmedi.
  - Yatay taşma yok.
- **Kontrol ürünleri** (varyantlı · tek görselli · uzun başlıklı): 1280'de üçünde de 600/600, galeri sol 0, taşma yok, başlık 18px; 390 değişmedi.
