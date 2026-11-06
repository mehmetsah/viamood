# #995977 kalem 4 · basım kanıtı — 6 Kas 2026 09:57:15 TSİ (Elif)
- Sahip kararı 6 Kas 09:36 «Hepsi sırayla»; dayanak ayse:858.
- **Kök (ölçüldü):**
  - Vitrindeki 100 tek varyantlı ürünün seçenek adı «Default Title» kaydedilmiş, «Title» değil. Bu yüzden `has_only_default_variant = false`.
  - `snippets/variant-main-picker.liquid:12` `{% unless product_resource.has_only_default_variant %}` seçiciyi basıyordu.
  - Sayfada etiket ve değer olarak «Default Title · Default Title» görünüyordu (görünür geçiş 2).
  - Doğru kayıtlı 374 üründe seçici zaten basılmıyordu.
- **Yama:** aynı satır `{% unless product_resource.has_only_default_variant or product_resource.variants.size == 1 %}` oldu (+2 satır yorum). Gizleme değil, basmama.
  - Çok varyantlıda (18 ürün) koşul aynı.
  - Ürün verisine dokunulmadı.
- md5 3118f841 → 32bfbe2e. KURU ✓ → PUT 200 → GET-back ✓. Geri alma: `GERI=1 bash calistir.sh`.
- **Canlı ölçüm** (1280 + 390, iki koşu birebir aynı):

  | Ürün | Seçici | Görünür «Default Title» |
  |---|---|---|
  | kare (seçenek «Default Title») | var → **yok** | 2 → **0** |
  | yatay (aynı kayıt) | var → **yok** | 2 → **0** |
  | dikey (seçenek «Title») | yok → yok | 0 → 0 |
  | çok varyantlı (Beden ×6) | var → **var** | 0 → 0 |

  - Sepet formundaki varyant kimliği dört üründe aynı.
  - Stoğu olan üç üründe «Sepete ekle» ve «Hemen al» etkin. Kare ürün stokta yok («Tükendi», JSON-LD OutOfStock); yamayla ilgisi yok.
  - 1280'de 600/600, başlık 18px.
