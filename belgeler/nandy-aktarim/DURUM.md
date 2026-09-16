# Nandy Home aktarımı — güncel durum

**Son ölçüm:** 16 Eylül 2026, 01:2x · **Ölçen:** Elif

## Canlı sayım (Shopify Admin API)
```
vendor=Nandy Home          402
  status=active              2
  status=draft             400
```
`sku-map.json`'daki 400 kayıtla birebir örtüşüyor — tutarsızlık yok.

## İş nerede kaldı
Aktarımın **yazma tarafı bitti**: 400 ürün Shopify'da duruyor. Takıldığı yer **yayın**.

Ölçülen jeton izinleri (34 izin):
```
write_products       VAR
read_products        VAR
write_inventory      VAR
write_publications   YOK   ← blokaj
read_publications    YOK   ← blokaj
```
`publications.json` → `403 "requires merchant approval for read_publications scope"`.

Aktarım script'i zaten `"status": "active"` gönderiyor (plan, satır 115) ama ürünler
taslakta kalıyor: uygulama Online Store yayın kanalına ürün bağlayamıyor.
`write_products` tek başına yetmiyor — **ölçümle doğrulandı**, varsayım değil.

Mekanizma teyidi (vitrin):
```
aktif ürün  (published_at dolu, scope=global) → /products/<handle>  HTTP 200
taslak ürün (published_at=None, scope=web)    → /products/<handle>  HTTP 404
```

## Kalan iki adım — ikisi de bizde değil
1. **İzin:** Shopify uygulamasına `read_publications` + `write_publications` onayı.
2. **Karar:** 400 ürün bir anda mı açılacak, kademeli mi? Katalog şu an ~55 aktif
   Via Mood ürünüyle dönüyor; 400 ürün vitrin/arama/koleksiyon dengesini değiştirir.
   Plan kademeli açılmayı öneriyor.

## Bu klasördeki dosyalar
| Dosya | Ne |
|---|---|
| `SPEC.md` | 28–30 Ağu tarihli özgün aktarım şartnamesi |
| `UYGULAMA-PLANI.md` | 13 Eyl uygulama planı, sayım düzeltmesiyle |
| `DURUM-12EYL-ELIF.md` | 12 Eyl durum raporu (içinde kendi sayım hatamın düzeltmesi) |
| `sku-map.json` | 400 kayıtlık SKU eşlemesi |
| `eslesme-raporu.json` | eşleşme özeti |
| `kuru-kosum.py` | **salt-okunur** kuru koşum — yazma yapmaz |


---

## Yayına hazırlık denetimi — 16 Eylül 2026 (Elif)

400 taslağın **tamamı** Shopify Admin API'den çekilip tek tek denetlendi
(`since_id` sayfalamasında yinelenen kayıt tuzağına karşı id'ye göre tekilleştirildi;
çekilen benzersiz taslak: **400/400**).

| Denetim | Sonuç |
|---|---|
| fiyatı 0 / boş | **0** |
| görseli yok | **0** |
| SKU boş | **0** |
| barkod boş | **0** |
| stok ≤ 0 | **10** |

**Eski bir inanış düzeltildi:** notlarda "29 fiyatsız ürün" geçiyordu — ölçümde
**fiyatsız ürün yok**. Veri tarafında yayına engel bir eksik kalmamış.

### Stok ≤ 0 olan 10 ürün — yayına engel DEĞİL
Onunun da `inventory_policy` değeri `deny`; yayınlanırlarsa vitrinde **"Tükendi"**
görünür, satılamaz ama zarar vermez. Stok girilince kendiliğinden satışa açılır.
Örnekler: Çiftli Ayakkabı Rampası 10'lu/20'li · Multibox 5 Lt · 12'li ve 24'lü
Clear Baharatlık setleri · 10 Parça Difriz Saklama Kabı Seti.

### Vitrin etkisi — ürün tipi dağılımı
```
Saklama Kabı 105 · Dolap İçi Düzenleyici 41 · Saklama Kutusu 22
Buzdolabı Düzenleyici 18 · Kesme Tahtası 16 · Çöp Kovası 13 · Sepet 12 · Kase 12
```
**400/400 üründe etiket var** → etikete dayalı koleksiyon kuralları bu ürünleri
kendiliğinden toplar. Kademeli açılacaksa doğal kesme noktası ürün tipidir
(ör. önce "Saklama Kabı" 105 ürün, sonra sırayla).

### Blokaj değişmedi
```
publications.json           → 403 "requires merchant approval for read_publications"
jeton: write_products VAR · write_publications YOK · read_publications YOK
```

### Hüküm
Veri tarafı **hazır**; bekleyen tek şey Shopify izni ve "toptan mı kademeli mi"
kararı. Yayın kararı verildiğinde ürün tarafında yapılacak hazırlık işi kalmıyor.
