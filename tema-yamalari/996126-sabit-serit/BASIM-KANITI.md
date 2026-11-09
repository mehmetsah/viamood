# #996126 · ayse:888 — ürün sayfası sabit satın alma şeridi · DURUM: BASILMADI (önizleme, Yunus onayı bekleniyor)

Tema 195348856964 (canlı). Talep: Yunus (Viamood) 7 Kas 12:13 · kart #996126 · kayıt ayse:888 (aşama uygulama, veren ŞAH).
Yalnız CSS; Liquid'e dokunulmaz.

| dosya | ÖNCE (canlı = ONCESI, 9 Kas 08:43 çekildi) | SONRA | değişen |
|---|---|---|---|
| assets/via-product-overrides.css | 50622 B 69d89501771c3eed2f23008efe40044e | fc75b1051007ad908859c7ade0c2df28 | şerit ızgara bloğu (ONCESI 557–581) |
| assets/via-mobile-app.css | 35751 B dc417d95200ab8981c2ad9ff5a526223 | 98cb34858658fd37aa2ae3270cf3ffc9 | #994650-FAB: WhatsApp payı 200 → 288 (yalnız ≤749) |

Kuru koşu (9 Kas, `KURU=1 bash calistir.sh`): canlı md5 = ONCESI (2/2) · sunucuda üretilen yama md5 = SONRASI (2/2) · PUT YOK.

## Önizleme nasıl üretildi
Canlıya yazılmadı. Canlı ürün sayfası tarayıcıda açıldı; yalnız bu iki CSS dosyasının isteği tarayıcı içinde
SONRASI ile yanıtlandı (Playwright `route`). Ölçüm ve görseller: `~/asistan-veri/mehmet/raporlar/996126-kanit/`
(`arac/onizle.cjs`, `once.json`, `sonra1.json`, `sonra2.json`, `satir-dagilim.json`, `mutasyon.txt`).

## BASIM (Yunus onayından SONRA)
`bash tema-yamalari/996126-sabit-serit/calistir.sh` — iki dosya önce kapıdan geçer (canlı = ONCESI, yama = SONRASI),
sonra PUT + GET-back; hata olursa yazılan dosya ÖNCESİ'ne döner. Canlı dosya bu arada değiştiyse basım DURUR.

## GERİ ALMA
`GERI=1 bash tema-yamalari/996126-sabit-serit/calistir.sh` — canlı = SONRASI olan iki dosyayı ters sırayla ÖNCESİ'ne yazar.
