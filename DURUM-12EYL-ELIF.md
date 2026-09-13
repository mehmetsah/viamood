# Nandy Home → Via Mood aktarımı — DURUM RAPORU
**Hazırlayan:** Elif (viamood asistanı) · **İsteyen:** HeyMate · **Tarih:** 12 Eylül 2026
**Yöntem:** Shopify Admin API üzerinden canlı ölçüm + `nandy-aktarim/` belgelerinin okunması
**Canlıya yazma:** YOK — tüm sorgular salt-okunur

---

> ## ⚠️ DÜZELTME — 13 Eylül (Elif)
> Bu rapordaki **566 ürün / 564 draft** sayıları YANLIŞ. Shopify'ın `since_id`
> sayfalaması bu katalogda çakışan sayfalar döndürüyor, elle sayım şişiyor.
> `products/count.json` ile kesin sayı: **402 ürün · 400 draft · 2 active**.
> 400 draft, sku-map'teki 400 kayıtla birebir — 6. maddedeki "sayı tutarsızlığı"
> diye işaretlediğim şey de bu sayım hatasıydı, veri sorunu değil.
> Güncel tablo: `UYGULAMA-PLANI.md`.


## Özet — tek cümle

Aktarım **yapılmış** (28–30 Ağu), veri **spec'e uygun**, ama **566 ürünün 564'ü hâlâ
taslakta ve hiç yayınlanmamış**. Kod `status: active` gönderiyor; ürünler yine de
Online Store'a düşmüyor. En olası sebep: kullanılan Shopify uygulamasının **yayın
kanalı (publication) yetkisi yok**.

---

## 1 · İş sıfırdan başlamıyor

`~/Desktop/viamood/nandy-aktarim/` altında tamamlanmış bir aktarım duruyor:

| Dosya | Ne |
|---|---|
| `SPEC.md` | 28 Ağu · *"Yunus'un 20 Ağu spec'i — bağlayıcı"* notuyla. Talepteki spec bu. |
| `import_nandy.py` | Aktarım script'i (+ faz1 / faz2 / düzeltme yedekleri) |
| `sku-map.json` | **400 kayıt**, SKU **1100–1499** — kararlı/idempotent eşleme |
| `aktarim-raporu.md` | Faz 1 raporu (örnek 5 ürün, ardından DURDURULDU) |
| `duzeltme-raporu.txt` | 30 Ağu · 7 ürünlük düzeltme turu |

Spec'in temel kuralları: yalnız `brand == "Nandy Home"`, SKU 1100'den +1,
fiyat `salePrice × 1,40 → en yakın 5 TL yukarı`, `compare_at` boş, vendor `Nandy Home`,
**yayın: aktif**, desi/ağırlık boş (kaynakta ölçü yok, tahmin üretilmeyecek).

---

## 2 · Canlıda ne var (12 Eyl ölçümü)

Katalogun tamamı tarandı — 635 ürün:

| Vendor | Ürün | Aktif |
|---|---|---|
| **Nandy Home** | **566** | **2** |
| Via Mood | 65 | 55 |
| Asrın Plastik | 2 | 1 |
| Küçük Mutfak Atölyesi | 1 | 0 |
| Super-Bag (Asrın Plastik) | 1 | 1 |

**Nandy Home durum dağılımı:** `draft 564` · `active 2`

Oluşturma tarihleri: 28 Ağu → 554 ürün · 30 Ağu → 10 · 4 Eyl → 2

### Aktif olan 2 ürün bu aktarımdan DEĞİL

SKU'ları **594** ve **595** (Smart Duo 32 L Katlanabilir Çamaşır Sepeti, Bej/Antrasit).
1100 aralığının dışında — yani daha önce katalogda olan, vendor'ı Nandy Home yazan
kayıtlar. Aktarımın ürettiği **hiçbir ürün yayında değil.**

---

## 3 · Veri kalitesi — spec'e UYGUN

Örnek bir taslak ürün tek tek doğrulandı (id `10464659144836`):

| Alan | Değer | Spec'e uygun mu |
|---|---|---|
| SKU | `1220` | ✓ (1100–1499 aralığında) |
| Fiyat | `550,00 ₺` | ✓ (×1,40 → 5 TL yukarı yuvarlanmış) |
| Barkod | `8681982061368N1` | ✓ (Trendyol değeri) |
| Etiket | **28 adet** | ✓ (25–30 aralığı) |
| Kategori | `Food Storage Containers` | ✓ (taksonomi atanmış) |
| Görsel | 2 | ✓ |
| Stok | 162 | ✓ |
| `status` | **DRAFT** | ✗ — spec "aktif" diyor |
| `publishedAt` | **None** | ✗ |

SKU biçimleri (783 varyant): tek-varyantta `1220`, çok-varyantta `1220-1` →
412 + 371. Boş SKU **yok**.

**SKU 1100'den başlama şartı karşılanmış.** `sku-map.json` 1100'de başlıyor,
1499'da bitiyor, `productMainId` anahtarlı ve idempotent.

---

## 4 · Kök neden — neden yayında değiller

Üç ölçüm bir arada:

1. **Script doğru şeyi istiyor.** `import_nandy.py` satır 342: `"status": "active"`.
   Ama payload'da yayın kanalı ataması **yok** (`published` alanı / publication yok).
2. **564 ürünün tamamında `published_at = None`** — yayınlanıp geri çekilmemişler,
   **hiç yayınlanmamışlar.** `updated_at` dağılımı da aktarım penceresiyle aynı
   (28–31 Ağu), yani sonradan biri elle taslağa çekmiş değil.
3. **Kullanılan token'ın yayın yetkisi yok.** GraphQL `publications` sorgusu şunu döndü:

   ```
   Access denied for publications field.
   Required access: `read_publications` access scope.
   ```

`read_publications` yoksa `write_publications` de büyük olasılıkla yok. Uygulama
Online Store yayın kanalına bağlı olmadığı için ürünler kanala düşemiyor ve taslakta
kalıyor. **Bu bir veri sorunu değil, yetki sorunu** — 564 ürünün içeriği hazır,
sadece vitrine çıkamıyorlar.

---

## 5 · 30 Ağu'da açık kalan iki kalem — güncel durumu

| Kalem | 30 Ağu raporu | 12 Eyl ölçümü |
|---|---|---|
| **43–44 mükerrer ürün** | "Mehmet'in a/b/c kararı bekliyor" | Nandy Home ile başka vendor arasında **aynı başlıklı ürün YOK (0)**. Script'in `mevcutlar` guard'ı bu kayıtları "zaten var — atlandı" diye geçmiş; mükerrer oluşmamış. Risk gerçekleşmedi. |
| **29 fiyatsız ürün** | "fiyat bilgisi bekliyor" | Nandy Home içinde **0,00 ₺ varyant YOK (0)**. Spec "tahmin üretilmez" dediği için bu ürünler hiç aktarılmamış → katalogda eksik duruyorlar, ama bozuk kayıt da yok. |

Ayrıca `duzeltme-raporu.txt`'de bırakılan bir kozmetik iş var: dört Freshbox ürünü
ile Penta sepette varyant etiketi ham tedarikçi stok kodu olarak görünüyor
("FRESHBOX KREM X2 1,17 Lt / X4 0,6 Lt"). Doğru ama vitrinde kaba. Karar bekliyor.

---

## 6 · Doğrulanması gereken bir sayı tutarsızlığı

Üç sayı birbirini tutmuyor ve sebebini **iddia etmiyorum**, ölçümü bırakıyorum:

- `sku-map.json`: **400** kayıt
- Canlıdaki Nandy Home ürünü: **566**
- Canlıda benzersiz SKU kökü: **393** (bunun 391'i ≥ 1100)

400 eşleme varken 566 ürün olması, ~166 ürünün eşleme dosyasında karşılığı
olmadığını düşündürüyor (ikinci koşuda map'e yazılmadan oluşmuş olabilir), ama
benim sayfalamalı taramamın da bir payı olabilir. **Yayın kararından ÖNCE
netleşmeli** — yoksa idempotentlik (bir ürün hep aynı SKU'yu korur) garantisi
kâğıt üstünde kalır ve tekrar koşuda çift kayıt riski doğar.

---

## 7 · Ne yapmadım, neden

- **564 ürünü yayına almadım.** Üç sebep: (a) yetki sorunu çözülmeden teknik olarak
  düşmez, (b) 6. maddedeki SKU tutarsızlığı netleşmeden tekrar koşu riskli,
  (c) 564 ürünü vitrine açmak müşteriye dönük büyük bir değişiklik — onay işi.
- **Script'i yeniden koşmadım.** Mevcut kayıtlara dokunmamak spec'in kırmızı çizgisi.
- Canlıya hiçbir yazma yapılmadı.

---

## 8 · HeyMate Asistan Admin'e ulaşması gerekenler

1. **Shopify uygulamasına yayın yetkisi verilmeli** — `read_publications` +
   `write_publications` scope'ları. Asıl tıkanma noktası bu; verilmeden 564 ürün
   yayına alınamaz.
2. **Yayın kararı:** 564 ürün topluca mı açılacak, kademeli mi? Katalog şu an
   55 aktif Via Mood ürünüyle dönüyor; bir anda 564 ürün eklenmesi vitrin, arama
   ve koleksiyon dengesini değiştirir.
3. **6. maddedeki sayı tutarsızlığı** (400 / 566 / 393) doğrulanmalı.
4. **29 fiyatsız ürün** için Trendyol'dan fiyat gelirse aktarıma eklenebilir.
5. **Freshbox + Penta varyant etiketleri** sadeleştirilsin mi? (6 ürün, kozmetik)

---

## Not — altyapı aksaklığı

Bu turda `faz2-bitis-dogrulama.txt` dosyası iCloud'da "dataless" duruma düştüğü için
okunamadı (`Resource deadlock avoided`). Depo iCloud senkronlu `~/Desktop` altında;
aynı sorun bugün `.env.local` ve iki tema deposunda da yaşandı. Depo iCloud dışına
alınmadan bu tekrarlayacak.
