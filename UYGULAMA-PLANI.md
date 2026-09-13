# Nandy Home → Via Mood (Shopify) · UYGULAMA PLANI
**Hazırlayan:** Elif · **İsteyen:** HeyMate · **Tarih:** 13 Eylül 2026
**Kaynak spec:** `SPEC.md` (Yunus'un 20 Ağu spec'i — bağlayıcı)
**Bu turda yazma YAPILMADI** — yalnız okuma + kuru koşum.

---

## 0 · Önce bir düzeltme (kendi hatam)

12 Eyl raporumda **"566 Nandy ürünü, 564'ü draft"** yazmıştım ve bunu bir
"tutarsızlık" diye işaretlemiştim. Yanlıştı: Shopify'ın `since_id` sayfalaması
bu katalogda **çakışan sayfalar** döndürüyor, aynı ürün birden çok sayfada çıkıyor
ve elle sayım şişiyor.

`products/count.json` ile kesin sayı:

| | Şişmiş sayım | **Kesin (count ucu)** |
|---|---|---|
| Nandy Home toplam | 566 | **402** |
| draft | 564 | **400** |
| active | 2 | **2** |

400 draft, `sku-map.json`'daki **400 kayıtla birebir**. Ortada tutarsızlık yok;
aktarım temiz çalışmış. Kuru koşum betiğine bu tuzak için koruma eklendi.

---

## 1 · Kaç ürün var

| | Adet |
|---|---|
| Kaynak varyant (Trendyol anlık görüntü, 28 Ağu) | 698 |
| — `Nandy Home` (kapsam) | **674** |
| — We House / GİNZAMAİSON / Paşabahçe / simplicity | 24 → kapsam dışı (SPEC) |
| Aktarılacak ürün (tekil `productMainId`) | **469** |
| — fiyatsız (`salePrice=0`) → atlanır | 29 |
| — **aktarılabilir** | **440** |
| Hâlihazırda aktarılmış (canlı draft) | **400** |
| **Kalan** | **69** |

---

## 2 · Alan eşlemesi

| Trendyol | Shopify | Kural |
|---|---|---|
| `productMainId` | ürün kimliği (gruplama) | Bir `productMainId` = bir Shopify ürünü; varyantlar altına toplanır |
| — | `variants[].sku` | **1100'den +1.** Tek varyant → `1234`; çok varyant → `1234-1`, `1234-2` |
| `barcode` | `variants[].barcode` | Aynen; yoksa boş |
| `title` | `title` | Aynen |
| `description` | `body_html` | **Birebir**; yalnız HTML biçimi temizlenir. Yeniden yazılmaz/özetlenmez |
| `salePrice` | `variants[].price` | `× 1,40 → en yakın 5 TL YUKARI`. `compare_at_price` **BOŞ** |
| `quantity` | envanter | `inventory_levels/set` ile yazılır (`inventory_management: shopify`, `policy: deny`) |
| `images[].url` | `images[{src, position}]` | Sırasıyla; Shopify URL'den kendi çeker |
| `attributes` (Renk / Boyut / Hacim) | `options[].name` + `option1` | Varyant ekseni buradan kurulur |
| `brand` | `vendor` | Sabit `Nandy Home` |
| `dimensionalWeight` | ağırlık/desi | **BOŞ** — kaynakta 613 kayıtta 0, ölçü alanı gelmiyor. SPEC: tahmin üretilmez |
| — | `tags` | 25–30 **Türkçe** etiket. Marka adı ve SKU etiket OLARAK KULLANILMAZ |
| `categoryName` | `product_type` + taksonomi | Türkçe ürün tipi + Shopify taksonomi kategorisi (GraphQL `productUpdate`) |
| — | koleksiyon | Mevcut **MANUEL** koleksiyonlardan 1–3 tanesi. **Yeni koleksiyon açılmaz** |
| — | SEO | Başlık ≤ 60, meta açıklama ≤ 160 karakter |
| `productMainId` | `metafields.nandy.main_id` | İdempotenslik çapası |

---

## 3 · Görseller nasıl taşınır

Kaynak varyant başına ortalama **4,2** görsel (en çok 8, en az 1, **görselsiz varyant 0**).
`images[].url` doğrudan Shopify'a `src` olarak verilir — dosya indirip yeniden
yüklemeye gerek yok, Shopify URL'den kendisi çeker. `position` sırayı korur.

---

## 4 · Varyant / stok / fiyat

- **Tek varyantlı ürün:** 342 · **çok varyantlı:** 127
- Varyant ekseni `attributes` içindeki Renk / Boyut-Ebat / Hacim alanından kurulur;
  bulunamazsa `Title / Default Title`'a düşer.
- Toplam stok (kapsam): **415.498**
- Fiyat örnekleri (kuru koşumdan, gerçek veriyle):

  | Ürün | Trendyol | → Shopify |
  |---|---|---|
  | 12'li Etiketli Baharatlık Seti | 349,90 ₺ | **490 ₺** |
  | 32 LT Smart Duo Çamaşır Sepeti | 549,90 ₺ | **770 ₺** |
  | Portatif Katlanır Laptop Sehpası | 749,90 ₺ | **1050 ₺** |
  | Bohem İp Rattan Duvar Sepeti | 1399,90 ₺ | **1960 ₺** |

---

## 5 · İdempotenslik — tekrar koşunca ne olur

Çapa: **`sku-map.json`** (`productMainId` → SKU) + ürün üstünde
`metafields.nandy.main_id`.

| Durum | Davranış |
|---|---|
| `productMainId` sku-map'te VAR (**400 ürün**) | Aynı SKU korunur. Script `mevcutlar` guard'ıyla "zaten var — atlandı" der; **çoğaltmaz** |
| sku-map'te YOK (**69 ürün**) | Yeni SKU alır, **1500'den** devam eder |
| Fiyatsız (**29 ürün**) | Atlanır, SKU harcanmaz |

**Kanıt:** canlıda aynı SKU kökünü paylaşan **0** ürün var. Mükerrer oluşmamış.
Ayrıca Nandy Home ile başka vendor arasında aynı başlıklı ürün de yok — 30 Ağu
raporundaki "43–44 mükerrer" riski gerçekleşmemiş.

Küçük sapmalar (izlenecek, engel değil):
- sku-map'te olup canlıda **olmayan: 9** → o koşuda hata almış olabilir, tekrar koşuda oluşur
- canlıda olup sku-map'te **olmayan: 2** → SKU 594/595, bu aktarımdan değil (eski katalog kaydı)

---

## 6 · Asıl tıkanma: ürünler yayına çıkamıyor

400 ürünün **hepsi draft** ve `published_at = None` — hiç yayınlanmamışlar.
Script `"status": "active"` gönderiyor, yani kod doğru şeyi istiyor.

Sebep yetki: token'da **`read_publications` scope'u yok** (GraphQL açıkça
"Access denied ... Required access: `read_publications`" dedi). `write_publications`
da yoksa uygulama Online Store yayın kanalına ürün bağlayamıyor ve ürün taslakta kalıyor.

**Bu bir veri sorunu değil.** İçerik hazır: örnek üründe SKU 1220, fiyat 550 ₺,
barkod, 28 etiket, taksonomi kategorisi, 2 görsel, stok 162 — hepsi spec'e uygun.

---

## 7 · Uygulama sırası (yazma adımı — ONAY BEKLİYOR)

1. **Yetki:** uygulamaya `read_publications` + `write_publications` verilir. *(Bu olmadan 2–4 anlamsız.)*
2. **Doğrulama koşusu:** mevcut 400 üründen 5'i yayına alınır, vitrinde görünüm + fiyat + görsel kontrol edilir.
3. **Toplu yayın:** kalan 395 ürün açılır. Katalog şu an 55 aktif Via Mood ürünüyle dönüyor; 400 ürün bir anda eklenince vitrin/arama/koleksiyon dengesi değişir → kademeli açılması önerilir.
4. **Kalan 69 ürün** aktarılır (SKU 1500'den).
5. **29 fiyatsız ürün** Trendyol'dan fiyat gelince eklenir.

---

## 8 · Bu turda üretilenler

| Dosya | Ne |
|---|---|
| `kuru-kosum.py` | Salt-okunur eşleme/kuru koşum betiği (yeni) |
| `eslesme-raporu.json` | Makine okunur çıktı (yeni) |
| `UYGULAMA-PLANI.md` | Bu belge |

Kuru koşum **hiçbir yazma yapmaz** — üç kaynağı da salt-okunur açar
(`nandy_products.json`, `sku-map.json`, Shopify `GET`).

---

## 9 · Onay gerektirenler

1. **`read_publications` + `write_publications` yetkisi** — asıl kilit.
2. **Yayın kararı:** 400 ürün kademeli mi, topluca mı?
3. **Kalan 69 ürün** aktarılsın mı (SKU 1500'den)?
4. **29 fiyatsız ürün** için Trendyol fiyatı.
5. **9 eksik ürün** (sku-map'te var, canlıda yok) tekrar koşuyla tamamlansın mı?
6. Freshbox + Penta varyant etiketleri sadeleşsin mi (6 ürün, kozmetik).

**Yazma/aktarma adımı ÇALIŞTIRILMADI** — talimat gereği admin onayına bırakıldı.
