# #995986 · ayse:863 KALEM 2 · basım kanıtı — 7 Kas 2026 09:07:50 TSİ (Elif)
- **Talep:** Yunus 6 Kas 08:05: «Hemen Al sol tarafta, Sepete Ekle sağ tarafta … WhatsApp ile sipariş ver … içi dolgulu».
- **Yama:**
  - `buy-buttons.liquid`: Sepete ekle bloğu `.via-al-cifti` içine alındı; önüne `via-satinal-ek` kip `hemen`. Standart çağrıya `hemen_ayri: true` eklendi.
  - `via-satinal-ek.liquid`: kip `hemen` yalnız Hemen al'ı basar; veri adası yalnız standart kipte.
  - CSS: çift tek flex öğesi; WhatsApp `#25D366` dolgu + `--empire-ink-soft` yazı.
  - DOM sırası = görsel sıra (sekme sırası da sol → sağ).
- **md5:**
  - `via-product-overrides.css` 965806de → a56bbb4e;
  - `via-satinal-ek` 12f1463b → a5f4ac38;
  - `buy-buttons` ab34b8f6 → 3f46ccff.
- KURU ✓ → PUT 200 ×3 → GET-back ✓ ×3. Geri alma: `GERI=1 bash calistir.sh`.
- **Canlı ölçüm** (üç ürün, iki koşu birebir aynı):

  | Genişlik | Satır 1 | Satır 2 | Satır 3 | Not |
  |---|---|---|---|---|
  | 1280 | adet · Hemen al (191) · Sepete ekle (191) | WhatsApp | — | — |
  | 390 | adet | Hemen al 149 \| Sepete ekle 149 (52px) | WhatsApp | CTA öncesi 32px korunuyor |

  - Hemen al tek kez basılıyor.
  - WhatsApp zemini #25D366, yazı rgb(26,26,26), kontrast 8.78:1. Beyaz yazı 1.98:1 kalırdı, bu yüzden seçilmedi.
- **Davranış:** Hemen al yeni yerinde seçili varyantı ve adedi gönderiyor (`{"id":…,"quantity":2}`) → /pages/odeme. İstek yakalandı; sepete yazılmadı.
- Çok-al şablonunun vqb düzeni değişmedi (kip `hemen` orada hiçbir şey basmaz); WhatsApp orada da dolgulu.
