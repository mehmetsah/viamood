# #994828 · Meta Purchase Pixel CANLI BASIM — ŞAH (21 Eki 2026)
_tur başladı 15:39:47_

## 1 · md.38
- envanter: açık 10 ağaç, viamood/994753/994828 ile çakışan YOK; kod-viamood'da yalnız ana checkout.
- ölçüm ağacı `/tmp/wt-994828` (detached origin/main 9c2fefc) açıldı, DB'ye yazıldı.

## 2 · BASIM ÖNCESİ ÖLÇÜM — ⛔ YAMADA SESSİZ KAÇAK BULUNDU
- canlı `sections/via-order-success.liquid` 12613 B `25482474…` = yedek = repo ÖNCESİ ✔ · main tema 195348856964 ✔
- çivi 7/7 · Liquid `{%` 4/4 `{{` 4/4 · script bloğu `node --check` OK
- **fbq zamanlaması (canlı, sayfa kaynağı + Playwright):** Facebook pikseli tema içinde DEĞİL, Shopify Web Pixel
  `3431923844` (runtimeContext OPEN) — web-pixels-manager sayfa yüklendikten SONRA asenkron indiriyor.
  Sayfa ayrıştırılırken `window.fbq` = undefined (DCL ~0,55 sn'de yok; 12-20 sn izlemede headless'ta hiç gelmedi,
  çünkü `/web-pixels@…` istekleri bot korumasına 429 düştü).
- Yamadaki `viaMetaPurchase` `typeof fbq !== 'function'` ise **anında false dönüyor, tekrar denemiyor** ⇒
  URL'de tutar olan yol (kapıda/havale) Purchase'ı **HİÇ atmazdı** — "gitti sanılır, gitmez" sınıfı.
  Önceki E2E bunu yakalamadı: `fbq`'yu 3,5 sn bekleyip ölçtü, olayın atıldığı ANI değil.
- ⇒ basım DURDURULDU, önce düzeltme (fbq hazır olana kadar bekleme, P1-tamamlayıcı `vmFbqHazirOlunca` kalıbı).

## 3 · DÜZELTME (kod) — main `bc40493d7a23a361d9285571a2f8c7f927d4af0c`
- dal `kod/994828-purchase-fbq-bekle` = main (ff), `ls-remote` birebir, yedeksiz commit 0, ezme-kontrol ✅ ×2
- `viaMetaPurchase`: fbq yoksa 250 ms × 80 (20 sn) bekler; tutar doğrulaması beklemeden önce; bellek koruması
- çivi 7 → **10/10**; mutasyon: bekleme kaldırıldı → **2 kırmızı**, bellek koruması kaldırıldı → **1 kırmızı** (diff -q ile diske indiği doğrulandı), geri alındı
- vitest tam takım **91 dosya / 933 test yeşil** · Liquid `{%` 4/4 `{{` 4/4 · `node --check` OK · ÖNCESİ'nden silinen satır **0**

## 4 · CANLI BASIM — tema 195348856964, `asset.value`, SSM (token makineye inmedi)
| | B | md5 |
|---|---|---|
| canlı ÖNCE (= yedek) | 12613 | `25482474add48602d1f371e28f7ce46d` |
| basımdan HEMEN önce yeniden okuma | 12613 | `25482474add48602d1f371e28f7ce46d` (aynı → PUT'a izin) |
| PUT | 200 | 15:47:39 TRT |
| **GET-back** | **15544** | **`8a855c06183c5017d81cc6af92a58f59` = main `bc40493`** ✔ |
- yedek: `~/asistan-yedek/994828-purchase-20261021/CANLI-YEDEK__via-order-success.liquid` (md5 `25482474…`)
- geri alma tek adım: yedeği aynı betikle bas (ÖNCE/YENİ md5'leri ters çevrilir)
- son okuma (doğrulama turundan sonra): 15544 B `8a855c06…`, main tema hâlâ 195348856964 ✔

## 5 · CANLI DOĞRULAMA — GERÇEK SİPARİŞ YOK · META'YA OLAY GİTMEDİ
Yöntem: doğrudan `/pages/siparis-alindi?order=<sahte>&total=…` (sipariş/ödeme/kart YOK). `facebook.com` istekleri route ile 204'e kesildi + CDP ile TÜM istek türleri (beacon dahil) kaydedildi.
| koşu | görünüm | fbq geliş | Purchase | eventID | tekrar açılış | js hata (yeni) |
|---|---|---|---|---|---|---|
| **gerçek Shopify pikseli** (stub yok) | PC 1440 | **658 ms** (ayrıştırma ~550 ms'de bitiyor ⇒ eski kod KAÇIRIRDI) | **1 kez** · 77,5 TRY | `via-pur-<no>` | **0** (localStorage) | 0 |
| **gerçek Shopify pikseli** + CDP | mobil 430 | **582 ms** · `fbq.loaded=true` | **1 kez** · 55,25 TRY | `via-pur-<no>` | — | 0 |
| gecikmeli fbq (3 sn sonra kayıt-stub'ı) | PC 1440 | 3000 ms | **1 kez @3361 ms** · 123,45 TRY | `via-pur-<no>` | — | 0 |
| gecikmeli fbq (3 sn) | mobil 430 | 3000 ms | **1 kez @3314 ms** | `via-pur-<no>` | — | 0 |
| negatif: tutar yok (kart yolu, sahte no) | mobil | gerçek | **0** | — | — | 0 |
| negatif: sipariş no yok | mobil | gerçek | **0** | — | — | 0 |
| negatif: tutar 0 | mobil | gerçek | **0** | — | — | 0 |
- ⚠ PC'de B/C/D/E adımları bot korumasına (429 "connection needs to be verified") düştü — ölçülemedi; aynı denetimler mobilde + gerçek piksel koşusunda geçti.
- **Meta'ya ağ çıkışı: 0.** Otomasyon tarayıcısında `navigator.webdriver=true` ve `fbevents.js` bu durumda HİÇBİR `facebook.com/tr` isteği yollamıyor (CDP: PageView dahil 0). Yani test olayları Meta verisini kirletmedi.
  ⚠ Aynı sebeple **Meta'ya ulaştığı uçtan uca ölçülemedi**: kanıt `fbq('track','Purchase',…, {eventID})` çağrısının gerçek piksel nesnesine doğru argümanla yapılmasıdır.
  Son halka ilk gerçek siparişte Events Manager'da `Purchase` + `via-pur-<sipariş no>` ile görülecek (Events Manager girişi bende yok).

## 6 · REGRESYON
- tasarım: ÖNCE/SONRA mobil 430 ekran görüntüsü **birebir** (yama yalnız `<script>` ekliyor, işaretleme değişmedi); PC 1440 temiz, yatay taşma yok.
- mobilde sipariş no satırı taşıyor → **test artefaktı**: 33 karakterlik sahte numara, ÖNCE'de de aynı (gerçek no `#1032` gibi kısa).
- js hata: tek hata `Section …__header_section not found in the section rendering response` — **ÖNCE ölçümünde de vardı** (temanın sepet-temizle sonrası başlık render'ı), yamadan gelmiyor. Yeni hata 0.
- çerez bandı: "Reddet" seçilirse Shopify pikseli fbq'yu yüklemez ⇒ Purchase gitmez (izin saygısı, beklenen).
- dokunulmayan: CAPI (#994827 Mehmet kararı bekliyor) · yatay varyasyon · tema çekirdeği · kasa açılmadı · token makineye inmedi.
- test artığı: canlı DB'ye yazılmadı; localStorage damgaları atılan tarayıcı bağlamlarındaydı. Temizlenecek kayıt YOK.
