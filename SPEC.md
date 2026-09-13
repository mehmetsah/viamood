# NANDY HOME → VIAMOOD (Shopify) ÜRÜN AKTARIMI — SPEC

Kaynak veri: `~/Desktop/viamood/nandy-aktarim/nandy_products.json`
(28 Ağu 2026'da Trendyol Satıcı API'sinden çekildi — 698 aktif/arşivlenmemiş varyant,
493 tekil `productMainId`. Kimlik/anahtar alanları temizlendi, dosyada SIR YOK.)

## Kapsam

- SADECE `brand == "Nandy Home"` olan kayıtlar aktarılır (674 varyant).
- `brand == "We House"` (21 varyant) ve tekil 3 kayıt (Paşabahçe / GİNZAMAİSON /
  simplicity) AKTARILMAZ — raporda ayrı listelenir, kararı Mehmet/Yunus verir.
- Varyantlar `productMainId` ile gruplanır → bir Shopify ürünü = bir productMainId.
  Varyant seçenekleri `attributes` içindeki Renk / Boyut-Ebat / Hacim vb. alanlardan kurulur.

## Alan eşlemesi (Yunus'un 20 Ağu spec'i — bağlayıcı)

| Alan | Kural |
|---|---|
| **SKU** | 1100'den başlar, +1 artar. **KARARLI ve İDEMPOTENT**: bir ürün bir kez SKU aldıysa hep onu korur. `sku-map.json` (anahtar: `productMainId`) tutulacak, tekrar çalıştırmada okunacak. |
| **Barkod** | Trendyol'daki `barcode` aynen. Yoksa boş. |
| **Açıklama** | `description` **birebir**. Yalnız HTML biçimi temizlenir (Türkçe metin AYNEN korunur, yeniden yazılmaz, özetlenmez). |
| **Etiket** | 25-30 adet **Türkçe** etiket. Marka adı ve SKU etiket olarak KULLANILMAZ. |
| **Koleksiyon** | Mevcut **MANUEL** koleksiyonlardan 1-3 tanesi seçilir. **Yeni koleksiyon açılmaz**, smart koleksiyona elle ekleme yapılmaz. |
| **Kategori** | Shopify taksonomi kategorisi + **Türkçe ürün tipi** (product_type). |
| **SEO** | Başlık ≤ 60 karakter, meta açıklama ≤ 160 karakter. |
| **Fiyat** | `salePrice` (Trendyol güncel satış, KDV dahil) **× 1,40** → **en yakın 5 TL YUKARI** yuvarla. `compare_at_price` BOŞ. |
| **Vendor** | `Nandy Home` |
| **Yayın** | Aktif |
| **Görseller** | `images[].url` sırasıyla yüklenir. |
| **Desi / kargo ağırlığı** | Kaynakta `dimensionalWeight` **tüm kayıtlarda 0** ve en/boy/yükseklik alanı gelmiyor. Spec ek maddesi gereği: **tahmin ÜRETİLMEZ, alan BOŞ bırakılır.** |

## Çalışma sırası

1. **ÖRNEK ÖNCE:** ilk **5 ürün** aktarılır ve raporlanır (Shopify admin linkleri + hesaplanan
   fiyat/SKU/etiket/koleksiyon dökümü). Yunus'un teyidi alınmadan **toplu aktarım BAŞLAMAZ.**
2. Teyit gelince kalan ~488 ürün toplu aktarılır (rate-limit'e uyarak).
3. Her koşuda `aktarim-raporu.md` güncellenir: başarılı / atlanan / hatalı ürünler + sebep.

## Kırmızı çizgiler

- Var olan Viamood ürünleri **silinmez, üzerine yazılmaz** — yalnız yeni ürün eklenir
  (aynı `productMainId` daha önce aktarıldıysa güncellenir, çoğaltılmaz).
- Yeni koleksiyon / yeni tema değişikliği / fiyat kuralı dışında müdahale YOK.
- Shopify erişimi yoksa iş DURDURULUR ve rapor edilir — kimlik değeri hiçbir dosyaya yazılmaz.
