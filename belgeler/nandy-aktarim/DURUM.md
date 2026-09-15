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
