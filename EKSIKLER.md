# Viamood — Eksik İşler / Yapılacaklar

> Hazırlayan: **Elif** (Viamood asistanı) · 5 Eki 2026 · istek: Mehmet Şah ("eksik ne iş varsa md çıkar, codex'te yapacağım")
> **(5 Eki: Yunus/grup talepleri eklendi — 13a-13g) · (8 Eki: Mikro ayağı kapandı, aşağıya bkz. 0. bölüm)**
> Ölçüm tabanı: `origin/main` = `3edb62a5d0a457e046e3c75ecf57140ab338f660` (8 Eki 2026 tazelemesi, Elif)
> Yöntem: canlı uç ölçümü (curl/Playwright) + `git merge-base --is-ancestor` + kod taraması. **Beyan değil, ölçüm.**
> Bu dosya kod DEĞİŞTİRMEZ; tespit ve yapılacak listesidir.

## 0. 8 EKİ 2026 — KOD AYAĞINDA KAPANANLAR (Elif)
Bu iki kalem Shopify erişiminden BAĞIMSIZ, bizim Next uygulamamızdaydı ve **main'e indi**.

| Kart | İş | Durum | Kanıt |
|---|---|---|---|
| **#992928** | Shopify→Mikro **VIA** aktarımı: siparişler BERCYEDEK'e düşüp VIA'ya düşmüyordu | ✅ **BİTTİ** | `63886e0` · main `5b874c4` |
| **#993105** | Etikette il **ve** ilçe ikisi de "Yenişehir" — **Mikro ayağı** (cari/fatura/sevk) | ✅ **BİTTİ** | `7f3b1a1` · main `3edb62a` |
| **#993095** | 17 Eyl'den beri birikenleri yeniden tetikle | ⏸ **Mehmet onayı** | `scripts/mikro-firma-eksikleri-tetikle.mts` |

**#992928 kökü — ve bu depo için asıl ders:** `syncOrderToMikro` girişinde KOŞULSUZ
`if (order.mikroSyncStatus === 'approved') return …` vardı. O statü ARADEPO bacağı biter
bitmez yazılıyor; ANA FİRMA (VIA) bacağı ondan SONRA best-effort çalışıyor ve hatası yalnız
`console.error`'a gidiyordu. Yani VIA bacağı bir kez düşünce **bir daha asla denenemiyordu**
(fulfillment sonrası re-sync de o satırda geri dönüyordu) ve statü `approved` olduğu için
dışarıdan "tamam" görünüyordu.
⚠ **Bu teşhis 1 Eyl 2026'da `aa5af546` ile ZATEN yapılmıştı ve main'e HİÇ İNMEDİ** — bugün
yalnız `yedek/goc-20260929-vp-02-aa5af546` ref'inde duruyor. Regresyon sınıfı "mantık yanlış
çalıştı" değil, **"doğru kod ağaçtan düştü"**. Aşağıdaki "main'e girmemiş 17 dal" satırı bu
yüzden kozmetik bir borç değil; her biri bu sınıftan bir arıza taşıyabilir.

**#993105 ikinci ayağı:** `aef52da` etiket ayağını kapatmıştı, ama aynı
`ship.district ?? ship.city` geri çekilmesi `mikro-sync.ts`'te **üç yerde** daha duruyordu
(`cariKayit` → `Adres1` + `FaturaAdresi` + `SevkAdresi`) — yani Mikro carisi hâlâ
"Yenişehir/Yenişehir" açılıyor, oradan kesilen fatura/irsaliye yanlış il taşıyordu.

**#993115 (ağdaki tüm Zebra'lar 10 dk'da bir basıyor) — kartın kuruluşu yanlıştı:**
`~HI` + `! U1 getvar` bir Zebra keşif el sıkışmasıdır; yazıcı NORMAL kipte olsa bunları
kanalda yanıtlar, **hiçbir şey basmazdı**. Basıyor olması yazıcıların **tanılama (dump)
kipinde** olduğunu gösterir ⇒ #993115 ile #993107 **aynı arızanın iki yüzü**. 10 dakikalık
yoklama zararsız; dump kipi kalıcı kapatılınca
(`belgeler/zebra/05-tanilama-kapat-ve-KALICI-yaz.zpl`) baskılar durur. Yoklayıcıyı aramak
gerekmiyor. Kalan iş fiziksel cihazlarda, Yunus'ta.

---

## ✅ Yunus'un 12 Maddesi — TİK DURUMU (6 Eki 2026 ölçümü, Elif)
Kanıt: raporlar/viamood-12-madde-envanter-20261006.md (canlı curl/Playwright + depo taraması).
⛔ ORTAK BLOKAJ (10/12 madde bunun arkasında bekliyor): via-mood Shopify mağazasına staff/collaborator erişimi yok → shopify theme list "you don't have access to this dev store" döner, theme pull/push yapılamaz. Tek açık: Mehmet'in via-mood mağazasına staff erişimi vermesi. Kod tarafı (Next app) bundan bağımsız, aşağıda ayrıca ilerliyor.

| # | Madde | Tik | Not / detay |
|---|---|---|---|
| 1 | Hukuki sayfa tasarım bütünlüğü (İade/Mesafeli/KVKK/Gizlilik aynı şablon) | KISMİ 2/4 | İade+Mesafeli zaten aynı tasarımda; KVKK handle↔şablon uyuşmazlığı (admin, 30 sn), Gizlilik sistem sayfasına kaçıyor (içerik kararı) — bkz 13e |
| 2 | SSS (ürün sayfası) | BİTTİ | ürün sayfasında sss/Sıkça/accordion canlı doğrulandı |
| 3 | Otomatik e-posta sistemi | KISMİ | çekirdek+tablo yazıldı (kod/991676-eposta-otomasyon) ama main'de değil, zamanlayıcı stub — bkz madde 6 (Shopify'dan BAĞIMSIZ, kod işi, ilerletilebilir) |
| 4 | Ürün detay boşluk/ortalama | ÖLÇÜLMEDİ | bütçe yetmedi, "bitti/eksik" denemez |
| 5 | Kargo saat sayacı (15:00'a kadar aynı gün) | YOK | snippet yazılmış (via-kargo-kesim-sayac.liquid) ama hiçbir şablona bağlı değil — bkz 13f |
| 6 | Ürün görseline rozet (ücretsiz kargo · vade farksız) | YOK | 0 eşleşme — bkz 13f |
| 7 | Türkçe slug /urunler/... | YOK | hâlâ Shopify varsayılanı /products/ (116) |
| 8 | Mobil sabit alt çubuk (WhatsApp+Sepete+Hemen Al) | KISMİ/ŞÜPHELİ | sticky+WhatsApp+Sepete var, Hemen Al 0 — bkz 13g |
| 9 | Varyasyon kutucuğu (Trendyol tipi) | YOK | Horizon'un kendi web bileşeni, kutucuk değil — bkz madde 10 |
| 10 | Footer ödeme yöntemi ikonları | YOK | hâlâ düz metin chip, svg/img 0 — bkz 13b |
| 11 | Evin favorileri mobilde taşma | AÇIK | 430px'te 52px taşma, kök sebep ölçüldü — bkz 13c |
| 12 | /pages/odeme taksit Tek çekim border-top | AÇIK | kök sebep bulundu, tek satır CSS fix hazır — bkz 13a |
| — | (ekstra) Ürün sayfası güvence bloğu kaldırma | AÇIK | hâlâ canlıda — bkz 13d |

Özet: 1/12 tam bitti, 3/12 kısmi, 7/12 açık/yok, 1/12 ölçülmedi. 10/12 Shopify erişimine kilitli.

## Durum özeti (bir bakışta)
| Gösterge | Değer |
|---|---|
| Test takımı | **725 yeşil** (`vitest run`, 8 Eki) |
| `tsc --noEmit` | **13 hata** — hepsi `tests/` altında, `src/` **0** |
| main'e girmemiş `kod/*` dalı | **17** |
| Prod'da koşmamış göç | **4** (`0027`, `0028`, `0029`, `0030`) |
| Shopify vitrin / bizim katalog | **389 ürün / ~60 ürün** |

---

## 🔴 YÜKSEK ÖNCELİK

### 1. Göç listesi elle yazılıyor → 4 göç prod'da hiç koşmadı
`scripts/deploy.sh` içindeki elle göç listesi **`0026_veri_silme`** ile bitiyor; oysa `drizzle/` altında
`0027_mail_log`, `0028_urun_sss`, `0029_user_yetkileri`, `0030_invite_tokens` var. Yeni göç eklenince
listeye yazmayı unutmak sessiz arıza üretiyor — ölçülen sonuç: aşağıdaki 2. madde.
**Düzeltme hazır ama main'de değil:** `kod/992334-deploy-goc-listesi` (`83e14c7`) listeyi dizinden türetiyor
(`ls drizzle/*.sql | sort -V`) ve 3 bilinçli istisna taşıyor.
⚠ `0007_shipping_rates` **fikir-tekrarlı değil** (`CREATE TYPE` kullanıyor, Postgres'te `IF NOT EXISTS` yok) —
listeyi körlemesine açmak her deploy'u kilitler, o yüzden istisna listesi şart.
· Dosya: `scripts/deploy.sh` · **Öncelik: YÜKSEK**

### 2. `/auth/davet?token=…` canlıda **HTTP 500** → davet linki üretilemiyor
`invite_tokens` tablosu prod'da yok (çünkü `0030` koşmadı, bkz. madde 1). Ekranın kendisi (`/auth/davet`) 200
dönüyor, token'lı istek patlıyor. Bu yüzden **#992326** (Yunus'a ürün SSS için dar yetkili hesap + tek
kullanımlık davet linki) ilerleyemiyor — üretilecek link 500 verir.
· Dosya: `drizzle/0030_invite_tokens.sql`, `src/lib/davet*.ts`, `src/app/auth/davet/` · **Öncelik: YÜKSEK**
· **Not:** madde 1 çözülünce bu kendiliğinden düzelir; ayrı kod gerekmez, doğrulama gerekir.

### 3. Sipariş takip linki hâlâ ESKİ Shopify sayfasına gidiyor
`src/lib/brand.ts` → `trackingPageUrl()` bugün `${STOREFRONT_URL}/pages/siparis-takip?order=…&email=…`
üretiyor. `/pages/…` Shopify'ın sayfa yoludur; kargo mailindeki link müşteriyi eski temaya düşürüyor
(canlı ölçüm: o sayfa hâlâ **200**). Çağrı yerleri: `src/lib/shopify/fulfillment-push.ts:234`,
`src/lib/server/fulfillment-service.ts:455`.
**İkinci kırık aynı zincirde:** `src/middleware.ts` `callbackUrl` kurarken **sorgu dizesini düşürüyor** —
canlı ölçüm: `/hesabim?siparis=VM1` → `307 → /auth/sign-in?callbackUrl=%2Fhesabim`, yani hangi siparişe
bakıldığı kayboluyor.
**Düzeltme hazır, main'de değil:** `kod/991987-takip-link-yonlendirme` (`736f619`).
· **Öncelik: YÜKSEK**

### 4. Shopify → bizim katalog senkronu eksik (389'a karşı ~60 ürün)
Senkron **cron değil webhook güdümlü** (`PRODUCTS_CREATE/UPDATE/DELETE` → `src/app/api/shopify/webhooks/route.ts:182`
→ `ingestShopifyProduct`). Webhook yalnız **ileriye dönük** çalışır; geçmiş katalog ancak
`scripts/backfill-products.mts` elle koşunca gelir ve görünüşe göre koşmamış/yarım kalmış.
Webhook ucu ayakta (GET → 405). ⚠ Betik prod DB'ye **yazar**; koşturma kararı sahipte.
· Dosya: `scripts/backfill-products.mts` · **Öncelik: YÜKSEK**

### 5. Kuyruk işleyicileri hâlâ **stub** — zamanlanmış hiçbir iş gerçekte çalışmıyor
`src/worker/index.ts` içindeki processor'lar yalnız `console.log` + `{ processed: true }` dönüyor
("Stub processors — Phase 2'de gerçek implementasyon gelecek"). BullMQ altyapısı (`src/lib/queue.ts`) ve
`QueueName.EmailNotify` hazır, ama tüketen yok. Bu, aşağıdaki 6. maddenin de ön koşulu.
· Dosya: `src/worker/index.ts` · **Öncelik: YÜKSEK**

### 13a. Taksit tablosu "tek çekim" kutusunun border-top çizgisi kesiliyor — **YÜZEY BELİRSİZ**
Yunus'un şikâyeti: *"tek çekimin border-top çizgisi altta kalıyor, %1 ya da az yukarıdan padding/margin verirsen çözülür."*
"Tek çekim" **üç ayrı yüzeyde** çiziliyor ve **hiçbirinde kesilen bir `border-top` bulunamadı**:
· `src/app/(storefront)/odeme/CheckoutForm.tsx:392-414` — tam `border` + `rounded-lg` kutucuk
· `src/components/halkode/DenemeFormu.tsx:243-256` — aynı desen
· `tema-yamalari/via-checkout.liquid.halkode-form-hp:483-515` (`.hp-tile`) — yalnız `border-color` kuralları
⚠ **Mehmet'ten girdi bekliyor:** ekran görüntüsünün alındığı **tam adres** (`/odeme` mi · `/odeme?halkode=1` mi ·
test linki mi). Yüzey belirlenmeden tahminle CSS yazmak yanlış dosyayı değiştirir.
· **Öncelik: YÜKSEK (girdi bekliyor)**

### 13b. Footer ödeme yöntemleri hâlâ düz METİN (ikon değil)
Canlı anasayfa footer'ındaki `vf-pay` bloğu ölçüldü: **6 chip · `<svg>` 0 · `<img>` 0** —
`VISA · MasterCard · Troy · Halkbank · Kapıda Ödeme · Havale/EFT` hepsi `<span class="vf-pay__chip">` metni.
Reklamcı/müşteri talebi bunların **ikon/logo** olması.
⚠ İki grup karıştırılmamalı: **VISA · MasterCard · Troy · Halkbank** gerçek **marka varlığıdır** (logo kalmalı);
**Kapıda Ödeme** ve **Havale/EFT** ise **ince çizgi (stroke) SVG** olmalı — emoji/AI-kokan ikon yasağı geçerli.
· Dosya: `sections/via-footer.liquid` (Shopify tema deposu) · **Öncelik: YÜKSEK**

### 13c. "Evin favorileri" mobilde taşıyor — regresyon GÜNCEL, ölçüldü
Playwright, canlı anasayfa, **430px**:
```
ızgara genişliği      : 382 px
grid-template-columns : 220.641px 201.719px   ← 2 sütun
çocuk sayısı 4 · GÖRÜNÜR KART 2 · yatay taşma 52 px
```
220.6 + 201.7 = 422.3 px > 382 px kapsayıcı ⇒ sütunlar kapsayıcıdan geniş üretiliyor.
**Teşhis:** `grid-template-columns` **`minmax(0, 1fr)` ile sınırlanmamış** ve/veya kart çocuklarında **`min-width:0` yok**.
· Dosya: `sections/via-mood-home-v2.liquid` (`.vmh2-products`)
⚠ **ÇAKIŞMA RİSKİ:** bu dosyada şu an **başka bir oturumun commit'siz işi** var (`fix/yunus-12-madde` dalı:
`via-hosgeldin-popup.liquid`, `via-mood-home-v2.liquid`, `templates/index.json`) — **önce o iş kapanmalı**,
yoksa onun yarım işi ezilir.
· **Öncelik: YÜKSEK**

---

## 🟠 ORTA ÖNCELİK

### 6. Otomatik e-posta akışları: çekirdek yazıldı, **zamanlayıcı + şablonlar yok**
`kod/991676-eposta-otomasyon` (`326d820`) üç tabloyu ve saf karar katmanını getiriyor
(A hoş geldin 0/+2g · B sepet terki +1sa/+24sa/+48sa · C checkout terki +1sa/+24sa, kişiye özel tek
kullanımlık kupon, %10 / 1.500 TL üstü 300 TL tavan, **60 gün freni**, çift-mail freni `UNIQUE(tetik_id, adim)`).
**Eksik:** planlı satırları tarayan koşucu (madde 5'e bağlı), şablon metinleri ve görsel (Ayşe onayına bırakıldı),
**İYS kalıcı onay kolonu** (müşteri bazlı, geri alınabilir — hukuki kayıt + iptal akışı ister).
· **Öncelik: ORTA**

### 7. Kişiye özel kupon yok — tek statik env kodu kullanılıyor
`src/lib/welcome-signup.ts` tek bir `WELCOME_DISCOUNT_CODE` okuyor; "kişiye özel + tek kullanımlık" şartı
karşılanmıyor. Madde 6'daki `eposta_kuponlari` tablosu bunu çözüyor ama bağlanmadı.
· **Öncelik: ORTA**

### 8. Meta Pixel: checkout olayları hiç doğmuyor
Canlı ölçüm (Playwright, `fbq` sarılarak): `/pages/odeme` ve ürün sayfasında izlenen **tek** olay
`trackShopify … PageView`. **InitiateCheckout yok, Purchase yok** ⇒ Meta reklam tarafı dönüşüm değeri görmüyor.
Kök neden: Shopify'ın kendi checkout'u kullanılmıyor (ödeme tema içi `/pages/odeme`), Web Pixel
`checkout_started`/`checkout_completed` yalnız kendi checkout'unda yayılıyor.
**Hazır ama main'de değil:** `kod/991406-meta-checkout-olaylari` (`ffd335b`) — yayım katmanı + sipariş-no bazlı
tek-yayım freni + 12 çivi. Tema yaması `tema-yamalari/via-checkout.liquid.meta-initiate-purchase` **uygulanmadı**
(Shopify erişimi yok).
⚠ Kartta "ViewContent/AddToCart değeri doğru gidiyor" yazıyordu; **bugün yeniden üretilemedi** — ürün
sayfasında da yalnız PageView çıktı.
· **Öncelik: ORTA**

### 9. `hesap.viamood.com.tr` (native) tarafında Meta Pixel hiç yok
Canlı taramada `fbq` / `connect.facebook.net` / `web-pixels-manager` → **0 eşleşme**. Vitrin (Shopify) tarafında
pixel var, native panel/vitrin tarafında yok.
· **Öncelik: ORTA**

### 10. Varyasyonlu ürünler için "kutucuk seçici" tasarımı (Yunus talebi, #992652)
Yunus Trendyol tarzı yatay kutucuk istiyor. Bugün canlıda **dikey tam genişlik radio satırları** var.
⛔ **İki engel:** (a) `shopify theme pull` yapılamıyor — *"you don't have access to this dev store: via-mood"*;
(b) `~/Projeler/viamood/clarity-empire-work` **kısmi kopya** (7 section, 2 blok) ve `product-information` /
`_product-details` dosyaları depoda yok — tema **Shopify Horizon**, seçici bir web bileşeni.
**Önerilen yol:** taban temayı değiştirmek yerine salt görsel CSS katmanı (seçim mantığına dokunmadan).
**Ön koşul: mağaza erişimi.**
· **Öncelik: ORTA (erişim gelirse YÜKSEK)**

### 11. `paytr_enabled` canlıda `true` ama yetim bayrak
Canlı RSC yükü: `paytr_enabled=true`, `card_gateway=halkode`, `halkode_enabled=true`, `iyzico_enabled=false`.
Tek müşteri-yüzeyi tüketicisi `src/app/(storefront)/odeme/CheckoutForm.tsx:427` ve `cardImplemented` true olduğu
için o blok **hiç çizilmiyor** ⇒ görsel etki yok. Ayrıca `api/v1/payment/paytr/initialize/route.ts` bayrağı
**hiç okumuyor**. Kapatmak `admin/settings` → Ödeme → PayTR anahtarı (DB ayarı, deploy gerekmez).
· **Öncelik: ORTA (temizlik)**

### 12. Halköde kart ekranı: kapı kapalı, teknik ayak hazır
Form canlı temada yayında (`/pages/odeme`'de 18 `data-hk=`), dört negatif güvenlik kanıtı da çivili
(log 0 · hata metni 0 · kalıcı depolama 0 · akış aynı sayfada). Görünürlüğü `?halkode=1` kapısı belirliyor;
parametresiz ziyaretçi **PayTR** akışında kalıyor. Dördüncü kanıtın çivisi `kod/991314-negatif-kanit-d` (`78cab30`)
dalında, main'de değil.
**Kalan adım kod değil karar:** kapının varsayılan akış yapılması (Yunus, onay kartı #991359).
· **Öncelik: ORTA**

### 13d. Ürün detayda "Sepete ekle" altındaki güvence bloğu kaldırılsın
Canlı ürün sayfasında dördü de hâlâ duruyor: **Stoktan hızlı hazırlık · Güvenli ödeme · Pratik kullanım · Dayanıklı malzeme**
(her biri 1 eşleşme).
· Dosya: `sections/via-mood-product-assurance.liquid` + `templates/product.json`
**Öneri:** dosyayı **silme** — `templates/product.json`'dan **blok kaydını çıkar**; geri alması tek satır.
· **Öncelik: ORTA**

### 13e. Yasal sayfaların tutarlılığı — kısmen hazır
Gizlilik Politikası · İade ve Teslimat · KVKK Aydınlatma · Mesafeli Satış Sözleşmesi dördü de **tek**
`sections/via-legal-page.liquid`'den besleniyor ⇒ ortak kabuk **zaten var**, ayrışma varsa yapısal değil
**içerik/başlık düzeyinde**. Dördünün karşılaştırmalı canlı ölçümü **henüz yapılmadı**.
· **Öncelik: ORTA**

### 13f. Kargo kesim saati sayacı bağlanmamış + ürün rozetleri eksik
· **Sayaç:** `snippets/via-kargo-kesim-sayac.liquid` yazılmış ama **hiçbir şablona bağlı değil** —
  canlı ürün sayfasında `geri sayım` / `countdown` / `kargo-kesim` → **0 eşleşme**.
· **Rozetler:** ürün görsellerinde **"Ücretsiz Kargo" 0**, **"Vade farksız" 0** eşleşme.
· **Öncelik: ORTA**

### 13. 17 dal main'e alınmayı bekliyor
Hepsi push'lu, `ezme-kontrol` geçmiş, çivili. Birikme büyüdükçe çakışma riski artıyor.
```
990686-form-mail 020db10 · 990686-meta-veri-silme-ucu 88b2c6c · 991314-negatif-kanit-d 78cab30
991347-halkode-kimlik-tek-kaynak e1958a8 · 991394-rollback-saglik-adresi 3da31fa
991406-meta-checkout-olaylari ffd335b · 991406-meta-odeme-olaylari af90ef0
991465-canli-iade-araci ac213cf · 991676-eposta-otomasyon 326d820
991987-takip-link-yonlendirme 736f619 · 992146-taksit-kutucuk 894356f
992334-deploy-goc-listesi 83e14c7 · halkbank-vpos-test 2b47ad0 · meta-fiyat-microdata b866a1a
meta-katalog-fiyat e99ee60 · meta-pixel-eksik-olaylar 0045568 · viamood-ads a6cf929
```
⚠ `kod/991406-*` **iki ayrı dal** ve `kod/992146-taksit-kutucuk` ile `bec4940` (main'de) aynı konuyu tutuyor —
merge sırası önemli, körlemesine sıraya koymayın.
· **Öncelik: ORTA**

---

## 🟡 DÜŞÜK ÖNCELİK

### 14. `tsc` 13 hata — hepsi test dosyalarında
`tests/halkode-sapma-kapisi.test.ts` (6), `tests/davet-acik-yol-ve-mail.test.ts` (3),
`tests/meta-pixel-deger.test.ts` (3), `tests/zpl-barkod-cikar.test.ts` (1). `src/` tarafı **temiz (0)**.
Çoğu `Object is possibly 'undefined'` ve bir `Unused '@ts-expect-error'`.
· **Öncelik: DÜŞÜK**

### 15. Ürün yorumlarında iki yarım ayak
`src/app/api/v1/storefront/reviews/route.ts:13` spam savunmasında **IP hash rate-limit TODO**;
`:129` `verifiedBuyer = true` sabit yazılmış, "orders tablosunda bu e-posta ile teslim edilmiş sipariş ara" TODO.
Yani şu an **her yorum doğrulanmış alıcı görünüyor**.
· **Öncelik: DÜŞÜK (ama güven etiketi yanıltıcı — isterseniz ORTA)**

### 16. KargoLab gönderi push'u bağlanmamış
`src/app/(vendor)/orders/ai-shipment/AiShipmentClient.tsx:244` → `// KargoLab push — TODO: implement`.
· **Öncelik: DÜŞÜK**

### 17. FAZ 2 "native" sipariş hattı yarım
`src/lib/env.ts:74` strangler bayrağı prod'da `shopify`. Native tarafta açık uçlar:
`src/lib/shopify/fulfillment-push.ts:164` (native siparişte Shopify push atlanıyor),
`src/lib/inventory/decrement.ts` (native stok düşümü), `src/app/api/v1/cart/*` ("Tema henüz kullanmıyor").
· **Öncelik: DÜŞÜK (bilinçli faz)**

### 18. Trendyol katalog entegrasyonu iskelet
`src/lib/env.ts:159` — Trendyol Product Integration API anahtarları tanımlı, çoklu tedarikçi katalog çekimi yazılmamış.
· **Öncelik: DÜŞÜK**

### 19. Meta uygulama konsolu adımları (kod değil, panel işi)
Facebook OAuth **canlıda çalışıyor** (`/api/auth/providers` → facebook; akış `www.facebook.com/v19.0/dialog/oauth`'a
PKCE ile gidiyor). Kalanlar Meta konsolunda: **Valid OAuth Redirect URI** =
`https://hesap.viamood.com.tr/api/auth/callback/facebook`; **Data Deletion Callback** =
`https://hesap.viamood.com.tr/api/auth/facebook/data-deletion`; uygulamanın **Live** moda alınması
(Development'ta yalnız uygulama rolündeki hesaplar giriş yapabilir).
· **Öncelik: DÜŞÜK (kod işi yok)**

---

## ⚪ BELİRSİZ (ölçülmedi)

### 13g. Ölçülmeyen üç alt madde (Yunus'un 12 maddelik listesinden)
· **md.6** ürün detay sayfası boşluk/ortalama sorunu
· **md.9** slug'ların Türkçe/doğru olması
· **md.12** mobilde WhatsApp / Sepete Ekle / Hemen Al butonlarının alt sabit (sticky) olması
Üçü de 5 Eki turunda **bütçe yetmediği için ölçülmedi** — "yapıldı" ya da "eksik" denemez, önce ölçüm gerekir.
· **Öncelik: BELİRSİZ**

---

## Erişim engelleri (iş değil, kapı — açılmadan ilerlemiyor)
| Engel | Etkilediği madde |
|---|---|
| Shopify mağaza erişimi yok (`via-mood` dev store) | 10, 8 (tema yaması), yasal sayfa düzeltmeleri |
| Prod DB VPC-özel, SSH 22 kapalı | 1/2 doğrulaması, 4 sayımı, 11 ayar satırı |
| Meta uygulama konsolu erişimi yok | 19 |
| Shopify tema deposu (`clarity-empire-work`) kısmi kopya + uzağı yok + başka oturumun commit'siz işi (`fix/yunus-12-madde`) | 13a-13f, 10 |

## Not
Bu dosya yalnız **tespit**tir; hiçbir koda dokunulmadı. Maddelerin çoğunda düzeltme zaten bir dalda hazır
(13. madde) — Codex'te çalışırken önce o dalı kontrol etmek ikinci kez yazmayı önler.
