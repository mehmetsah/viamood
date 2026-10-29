# #995332 · ayse:802 · basım kanıtı — 29 Eki 2026 17:31 TSİ (ŞAH)
- **Önizleme teması 197044142212** (canlı 195348856964'ün `themeDuplicate` kopyası, UNPUBLISHED). CANLIYA YAZILMADI: canlı md5'ler basımdan sonra yeniden ölçüldü — theme.liquid c7f54c89 · via-product-overrides.css 0d5fc0a3 (aynı), via-kart-gorsel.js canlıda 404.
- Önizlemede 3 dosya: `assets/via-kart-gorsel.js` (YENİ, md5 a15d7297) · `assets/via-product-overrides.css` 0d5fc0a3 → 650ac685 (yalnız `ek-blok.css` eklendi) · `layout/theme.liquid` c7f54c89 → 81c6fe64 (satır 59 sonrasına tek `<script … defer>` satırı). Her biri PUT 200 + GET-back md5 ✓.
- Ölçüm (Playwright, imleç kartların dışında, 390/768/1280, 33 kart): kap 154×231 / 336×504 / 288×432 ÖNCE = SONRA; kart · kap · başlık · fiyat konumu 0 fark; betik 33/33 görsele uygulandı (ölçek 0,88–1,30); taşma 0.
- Önizleme: https://viamood.com.tr/search?q=how+wheels+premium&options%5Bprefix%5D=last&preview_theme_id=197044142212 (yalnız contain: `&via_kirp=0`)
- **Canlıya alma (tek adım, onaydan sonra):** `KIP=CANLI bash calistir.sh` — canlı md5 = ÖNCESİ kapısı, yama, GET-back; hata olursa otomatik geri alma.
- Geri alma: `KIP=GERI TEMA_ID=<id> bash calistir.sh` (JS silinir, iki dosya ÖNCESİ'ne döner).
- Önizleme temasının işi bitince silinmesi sahibin kararı (tema silme = kalıcı silme kapısı); ben silmedim.

## Ayak 2 · koleksiyon (kategori) kartı — 29 Eki 2026 18:37 TSİ (Elif)
- Önizleme 197044142212 önce `SIFIRLA=1` ile CANLI tabanına eşitlendi (kopya 17:31'de alındığı için kategori bölümü eski 3/4'teydi; canlıda #995388 ile 2/3), sonra 4 dosya basıldı. Her biri PUT 200 + GET-back ✓.
- `sections/via-koleksiyon-v2.liquid` fbd001dd → 5452b172: 387. satırın altına tek satır `.vkol2-card .vkol2-media{background:transparent} .vkol2-card .vkol2-media img{object-fit:contain}`. Oran (2/3) ve renkler değişmedi; zemin kartın kendi beyazı.
- `assets/via-kart-gorsel.js` a15d7297 → 28ac48f7: seçici `+ .vkol2-media img`. Ölçek sınırları aynı.
- Ölçüm (3 kategori × 1280/768/390, 12'şer kart): içerik kesilen kart canlı 0/7–8/7 → önizleme 0/0/0. Kart · kap · başlık · fiyat · rozet · kalp konumu canlıyla 0 fark (ürün sırası aynı yüklemelerde). Arama kartı (33×3) 0 fark. Hover 1,04 yakınlaşmada içerik kabın %92'si.
- Canlı md5 (tur sonu): theme.liquid c7f54c89 · overrides 0d5fc0a3 · koleksiyon fbd001dd · JS 404 → DEĞİŞMEDİ.
- Canlıya alma tek adım (onaydan sonra): `KIP=CANLI bash calistir.sh` (4 dosya, md5 kapılı).

## Ayak 3 · tek hâl — 29 Eki 2026 ~19:00 (Elif)
- PR #10 (#995388, `tema-yamalari/995388-kategori-gorsel/`, 05795a8) bu dala merge edildi; PR #10 kapatıldı. Tek PR: #9.
- Bağ: bu paketin kategori ÖNCESİ'si (fbd001dd) = #995388 SONRASI = canlıdaki dosya (md5 ile ölçüldü). Çivi bunu sabitliyor.
- Canlıya alma sırası değişmedi: #995388 zaten canlı; `KIP=CANLI bash calistir.sh` 4 dosyayı basar.
- Önizleme 197044142212 ölçümü (4 kategori × 1280/768/390): içerik kesilen kart 0, taşma 0, hiza farkı 0 (sıra-sabit yüklemeler). Canlı md5 değişmedi.
