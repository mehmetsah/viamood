# #995932 · basım kanıtı — 5 Kas 2026 12:06:49 TSİ (Elif)
- Talep: Yunus (5 Kas) — PDP başlığı (h1) computed 43.584px; hedef 18px, kabul bandı 16-20px.
- **Kök:** başlık bloğu `templates/product.json › sections.main › product-details › text_GnyQiN` `type_preset: "h2"`.
  - h1, `base.css` `.text-block.h2 :is(h1, …)` kuralıyla `font-size: var(--font-h2--size)` alıyor (`h1, .h1.h1` kuralından daha özgül).
  - `--font-size--h2: clamp(2.25rem, 4.8vw, 3.0rem)`: tema ayarlarından üretilen satır içi `<style>` (sayfa satırı 595).
  - Sonuç: 908px pencerede 0.048 × 908 = **43.584px**; ≥1000px'te 48px; 750–999px arasında 36–48px.
- **Yama:** aynı alan `"h2"` → `"h5"`. Tema ölçeğinde `--font-size--h5: 1.125rem` = **18px**, sabit değer.
  - Tek satır, tek JSON yolu (`tests/tema-995932-pdp-h1.test.ts`).
  - md5 `51343646fd65b43e985fc483ec708bc3` → `cf7c0cf059ebf9cab39c3f84f6d38e82`.
- KURU kapı ✓ → PUT 200 → GET-back ✓. Geri alma: `GERI=1 bash calistir.sh`.
- **Değişmeyenler (ölçüldü):**
  - aile (Inter), kalınlık (700) ve harf aralığı (−0.015em) `empire-overrides.css` `h1…{… !important}` kuralından gelmeye devam ediyor;
  - satır oranı 1.32 `via-product-overrides.css` `h1,h2,h3{line-height:1.32 !important}` kuralından gelmeye devam ediyor;
  - renk, `text-wrap: balance`, genişlik (336px), sol konum ve kenar boşlukları aynı.
- **Canlı ölçüm** (enjeksiyonsuz, iki koşu birebir aynı):

  | Genişlik | font-size önce → sonra | Satır sayısı önce → sonra | Not |
  |---|---|---|---|
  | 1280 | 48px → **18px** | 9 → 3 | |
  | 908 | 43.584px → **18px** | 8 → 3 | |
  | 390 | 19px → 19px | — | değişmedi |

  Yatay taşma her iki durumda da yok.
- **Mobil (≤749px) 19px:** `assets/via-mobile-app.css` içindeki `.product-information h1, .product-details h1, .group-block h1 { font-size: 19px !important }` kuralından geliyor.
  - Kabul bandı içinde.
  - Seçici `.group-block h1` ile başka yüzeylere de değdiği için dokunulmadı.
- **Dokunulmayan, aynı h2 ön ayarını kullanan yüzeyler:**
  - `templates/product.cok-al.json` başlığı (1 aktif ürün; 908px'te hâlâ 43.584px, ölçüldü);
  - `404.json`, `article.json`, `page.json`, `page.contact.json` h1'leri;
  - `search.json` başlığı;
  - `marquee` blok/bölüm varsayılanı (`var(--font-size--h2)`).
