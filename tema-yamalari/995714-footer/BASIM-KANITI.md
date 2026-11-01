# #995714 · basım kanıtı — 1 Kas 2026 14:48 TSİ (Elif)
- Talep: Yunus, WhatsApp ekran görüntüsü (1 Kas 2026). Canlı tema 195348856964 · `sections/via-footer.liquid` md5 f4d3955a → 7130bfe3.
- Üç değişiklik: (1) sol sütundaki telefon + e-posta satırı kalktı, (2) sol alttaki WA/IG/@ yuvarlakları (`.vf-social`) kalktı, (3) adres «Bize Ulaşın» listesinin son satırına taşındı (`li.vf-adres`, konum ikonu aynı SVG).
- Eklenen CSS yalnız `.vf-adres { font-size:0.92rem; line-height:1.5 }` (komşu bağlantılarla aynı ölçü). Renk verilmedi: sol sütunda `--vf-muted` tanımlı olduğu hâlde metin beyaz hesaplanıyordu (tema genelinde ezme; ölçüldü), görünüm aynen korundu.
- Artık kullanılmayan `.vf-contact-row` / `.vf-social` CSS kuralları bilinçli olarak yerinde bırakıldı (yalnız istenen üç değişiklik).
- KURU kapı ✓ → PUT 200 → GET-back ✓. Geri: `GERI=1 bash calistir.sh`.
- Canlı ölçüm (enjeksiyonsuz, 1280 ve 390): sol sütunda tel 0 · mailto 0 · `.vf-social` 0; «Bize Ulaşın» 5 satır, adres son satır, 14.72px / 22.08px; yatay taşma yok; footer'daki `tel:` bağlantısı 2 → 1.
- Önce/sonra: https://asistanim.tr/tunel/dosya/naU3XZ04DNBvF3UXQrfmc2RM/995714-viamood-footer-once-sonra.html (30 gün).
