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

## E1 kapanışı · EN_AZ 0,85 → 1 — 31 Eki 2026 20:28 TSİ (ŞAH)
- Sebep (ŞAH md.31 imza turu, 31 Eki): `EN_AZ = 0.85` kenardan kenara dolu görselleri ~%88'e küçültüp etrafında yapay beyaz paspartu oluşturuyordu (141/240 görsel düz contain'in altında; Pola beyaz oranı medyanı %3 → %25).
- Kod 74c2ddd: `YENI/assets__via-kart-gorsel.js` satır 13 `EN_AZ = 1` — başka sabit/dosya değişmedi. JS md5 28ac48f7 → **1ff0b65f** (`md5.json` yama.py ile yeniden üretildi; ÖNCESİ/SONRASI 3 dosya aynen).
- Önizleme 197044142212: `KIP=ONIZLEME ONIZLEME_ID=197044142212 SIFIRLA=1` — canlı = ÖNCESİ kapısı ✓, 4 dosya ÖNCESİ'ne sıfırlandı, PUT 200 ×4 + GET-back ✓ ×4. Bağımsız GET: önizleme 81c6fe64 · 650ac685 · 5452b172 · 1ff0b65f; CANLI c7f54c89 · 0d5fc0a3 · fbd001dd · JS 404 (YAZILMADI).
- Ölçüm (5 sayfa × 390/768/1280, 240 görsel, servis edilen JS'te EN_AZ 1 doğrulandı): ölçek < 1 **0/240** · kesik > %1 **0** · taşma **0** · Pola beyaz medyanı %3,7/3,5/3,5 (canlı %3,3/3,5/3,5). Ham veri: `raporlar/995332-kanit/e1-kapanis/olcum.json`.
- Açık bulgu E6 (bu commit'te düzeltilmedi): 1280'de ızgara «uzaklaştır» geçişinden hemen sonra 3/32 kartta ≤ %1,96 kesik (betik kaydırmayı px yazıyor, kap boyunu izlemiyor); pencere boyutu değişince 0. Kaydırmayı % yazan tek satırlık düzeltme benzetimde 0/32 verdi.
- tsc: PR yeni hata eklemiyor (taban 61 = dal 61, PR dosyalarında 0) — taban origin/main 1e9a375, 31 Eki ölçümü.
- md.31 imzası bu turda YAZILMADI; canlıya basım YOK (müşteri kararı bekleniyor).

## E6 kapanışı · kaydırma px → % — 31 Eki 2026 21:02 TSİ (ŞAH)
- Sebep (E1 kapanışında ölçüldü): betik kaydırmayı px yazıyor ve kap boyunu izlemiyordu; 1280'de ızgara «uzaklaştır» geçişinde (kap 288 → 105,6, pencere boyutu değişmeden) 3/32 kartta ≤ %1,96 kesik. EN_AZ 0,85'in küçültme payı bunu örtüyordu.
- Kod 91d8a5f: `YENI/assets__via-kart-gorsel.js` satır 51 — `translate` görselin kendi kutusuna göre % (`-100*s*(ccx-W/2)/W`); kap oranı sabit (2/3) olduğundan kap genişliği değişse de kaydırma doğru kalır. `EN_AZ = 1` dahil başka satır değişmedi. Dosya E1 turundaki benzetim dosyasıyla (`e6-benzetim/js-enaz1-yuzde.js`) bayt bayt aynı (cmp). JS md5 1ff0b65f → **56315963** (`md5.json` yama.py ile; ÖNCESİ/SONRASI 3 dosya aynen).
- Önizleme 197044142212: `KIP=ONIZLEME ONIZLEME_ID=197044142212 SIFIRLA=1` — canlı = ÖNCESİ kapısı ✓, 4 dosya ÖNCESİ'ne sıfırlandı, PUT 200 ×4 + GET-back ✓ ×4. Bağımsız GET: önizleme 81c6fe64 · 650ac685 · 5452b172 · 56315963; CANLI c7f54c89 · 0d5fc0a3 · fbd001dd · JS 404 (YAZILMADI).
- Ölçüm: ızgara «uzaklaştır» 1280 geçiş sonrası **0/32** (iki ayrı koşu, en çok %0,39); 5 sayfa × 390/768/1280, 240 görsel: ölçek < 1 **0** · kesik > %1 **0** · taşma **0** · beyaz ve görsel boyu medyanı 15/15 satırda d18f720 paketiyle birebir (fark 0,0) · hover 1280 ilk 8 kart en çok %0,38. Servis edilen JS'te kaydırma %, 240/240 görselin hesaplanmış translate'i %. Ham veri: `raporlar/995332-kanit/e6-kapanis/`.
- Çivi 8/8 (+ «E6 · kaydırma YÜZDE biriminde yazılır, px yazılmaz»); mutasyon (JS px + md5.json yeniden = d18f720 paketi) → yalnız E6 iddiası kırmızı.
- tsc: PR yeni hata eklemiyor (taban 61 = dal 61, PR dosyalarında 0) — taban origin/main 9b674f2, 31 Eki ölçümü.
- md.31 imzası bu turda YAZILMADI; canlıya basım YOK (müşteri kararı bekleniyor).
