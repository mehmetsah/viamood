# Yunus maddeleri — 21 Ekim 2026 güncel kontrolü

Taban: main `94ce2c2`. Bu tur main'e veya Shopify temasına yazmaz.
Eski `EKSIKLER.md` tablosu 8 Ekim ölçümüdür; aşağıdaki dar canlı gözlemleri
o tarihteki tüm eksiklerin hâlâ sürdüğü varsayımını geçersiz kılar.

## Ölçülen mevcut durum

Canlı tarayıcı: 1363×936, anasayfa + aşağıdaki ürün. Mobil bu oturumda
ölçülmedi; üç çözünürlüklü CI ayrı sonuç üretecek.

Ürün: `/products/etiketli-18li-antrasit-ekonomik-kirilmaz-saklama-kabi-seti-x6-175-12-05-lt`

| # | İş | Bu tur kanıt / kalan |
|---|---|---|
| 1 | Hukuki sayfa bütünlüğü | İade, mesafeli satış, gizlilik ve KVKK yollarının dördü GET ile 200. Görsel tutarlılık henüz kabul edilmedi. |
| 2 | Ürün SSS | Bu üründe düğme tıklandı; soru ve cevap görünür. Diğer ürünler / mobil ayrı kabul. |
| 3 | E-posta otomasyonu | Kod ve testler mevcut; canlı izin, gönderim ve zamanlayıcı kanıtı bu tur yok. |
| 4 | Ürün detay boşluğu | Dış `.product-information` genişliği 1353, sol 0; `.vm-tabs-fw` 1180. Dış section tek başına kusur kanıtı değildir. Tasarım ölçümü açık. |
| 5 | Kargo sayacı | Ürün ve sabit çubukta geri sayım görünüyor; `.vks-satir` gap 8px. Takvim/kesim saati doğruluğu bu gözlemle kabul edilmez. |
| 6 | Görsel rozetleri | Örnek üründe Kargo Ücretsiz görünüyor; vade farksız/koşullu rozetlerin tamamı kabul edilmedi. |
| 7 | Türkçe `/urunler` yolu | Aynı ürün handle'ı `/urunler/` altında GET 404. Shopify yönlendirmesi açık; Next rewrite Shopify vitrininin rotasını çözmez. |
| 8 | Mobil alt çubuk + Hemen Al | Örnek üründe Hemen Al yok. Mobil çakışma ölçümü ve tema değişikliği açık. |
| 9 | Yatay varyasyon kutuları | Hazır CSS main'de; gerçek varyasyonlu ürün seçimi/stok/fiyat kabulü açık. |
| 10 | Footer ödeme ikonları | Anasayfada `.vf-pay svg,.vf-pay img` sayısı 6. Eski “ikon 0” kaydı bu sayfada artık geçerli değil. |
| 11 | Evin favorileri mobil taşma | Masaüstünde 4 kart, 1313px grid, 4×311.75px sütun. Mobil kabul henüz yok. |
| 12 | Tek çekim üst kenarlığı | Yama main'de mevcut; aktif ödeme temasında görsel kabul bu tur yok. |

## Bu dalın kod değişikliği

- PR #3'teki `InitiateCheckout` depolama hatası düzeltmesini içerir.
- `purchaseYay`: Pixel hata verince false döner, hata ödeme akışına taşmaz,
  damga yazılmaz ve aynı Pixel ile tekrar deneme mümkündür.
- Depolama okuma/yazma engellense veya depo bulunmasa bile aynı Pixel
  örneğinde aynı sipariş ikinci kez yayınlanmaz. Kimlik kırpılarak gönderilir.
- Kalıcı depo çalışıyorsa farklı Pixel örnekleri için mevcut fren korunur.
- Bellek freni sayfa yenileme/sekmeler arası garanti değildir. Bu yardımcı
  **ödeme doğrulamaz**; canlı ödeme başarısına bağlanmış değildir.

## Test kanıtı

- Yeni Purchase testleri eski kodda **5 FAIL / 16 PASS**, düzeltmede **21/21 PASS**.
- Yerel birim/regresyon paketi: **89 dosya / 917 test PASS**; gerçek Postgres
  entegrasyonu yerelde dışarıda tutuldu (`--exclude tests/integration/**`).
- `npx tsc --noEmit -p tsconfig.deploy.json`: PASS.
- `npx playwright test --config playwright.yunus.config.ts --list`: 18 kontrol
  keşfedildi. Keşif, tarayıcı testlerinin geçtiği anlamına gelmez.
- Ayrı CI, 360/430/1440 genişliklerde canlı GET taraması ve SSS tıklaması yapar;
  ekran, video, trace ve HTML raporu saklar. Ödeme/sepet/müşteri/admin yazmaz;
  POST isteklerini ve Meta izleme hostlarını engeller. Gerçek Meta kabulü değildir.
- Hemen Al ve `/urunler` açıkları CI'da kırmızı çıkabilir; sonuç gizlenmez.

## Kalan erişim ve canlı kabul

Bu oturumda GitHub erişimi çalışıyor; Via Mood Shopify yönetim bağlantısı,
tema kopyasına yazma imkânı, Meta test olayları erişimi ve prod DB erişimi yok.
Shopify eklentisi önceki oturumda önerilmiş; henüz bağlı değil.

Tema tamamlamak için aktif tema GET → yedek → kopyada üç yönlü diff →
mobil/masaüstü kabul → GET-back gerekir. Mevcut bir repo yaması tek başına
canlı değişiklik sayılmaz. Kaynak dosyalardaki geçmiş “canlıya basılmadı”
notları da bugünkü canlı durumu tek başına göstermez.

Purchase için URL'deki `order/total` güvenilir ödeme kanıtı değildir.
Sunucuda doğrulanmış tahsilattan türeyen yük, sipariş bazlı tekilleştirme ve
Meta Test Events kanıtı olmadan bu madde kapatılmamalı.
