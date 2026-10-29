# #995332 · ayse:802 · basım kanıtı — 29 Eki 2026 17:31 TSİ (ŞAH)
- **Önizleme teması 197044142212** (canlı 195348856964'ün `themeDuplicate` kopyası, UNPUBLISHED). CANLIYA YAZILMADI: canlı md5'ler basımdan sonra yeniden ölçüldü — theme.liquid c7f54c89 · via-product-overrides.css 0d5fc0a3 (aynı), via-kart-gorsel.js canlıda 404.
- Önizlemede 3 dosya: `assets/via-kart-gorsel.js` (YENİ, md5 a15d7297) · `assets/via-product-overrides.css` 0d5fc0a3 → 650ac685 (yalnız `ek-blok.css` eklendi) · `layout/theme.liquid` c7f54c89 → 81c6fe64 (satır 59 sonrasına tek `<script … defer>` satırı). Her biri PUT 200 + GET-back md5 ✓.
- Ölçüm (Playwright, imleç kartların dışında, 390/768/1280, 33 kart): kap 154×231 / 336×504 / 288×432 ÖNCE = SONRA; kart · kap · başlık · fiyat konumu 0 fark; betik 33/33 görsele uygulandı (ölçek 0,88–1,30); taşma 0.
- Önizleme: https://viamood.com.tr/search?q=how+wheels+premium&options%5Bprefix%5D=last&preview_theme_id=197044142212 (yalnız contain: `&via_kirp=0`)
- **Canlıya alma (tek adım, onaydan sonra):** `KIP=CANLI bash calistir.sh` — canlı md5 = ÖNCESİ kapısı, yama, GET-back; hata olursa otomatik geri alma.
- Geri alma: `KIP=GERI TEMA_ID=<id> bash calistir.sh` (JS silinir, iki dosya ÖNCESİ'ne döner).
- Önizleme temasının işi bitince silinmesi sahibin kararı (tema silme = kalıcı silme kapısı); ben silmedim.
