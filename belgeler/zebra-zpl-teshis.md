# Zebra — ZPL komutları çalışmıyor, düz metin basılıyor

**Hazırlayan:** Elif · **Tarih:** 15 Eylül 2026
**Belirti:** `~HI` ve `! U1 getvar "device.product_name"` gönderiliyor, yazıcı komutu
**çalıştırmıyor**, karakterleri olduğu gibi kâğıda basıyor.

---

## 1 · Bizim yazılımımız bu işin içinde DEĞİL — ölçüldü

```
src/ + scripts/ içinde "zpl|zebra" geçen dosya : 0
"^XA" / "~HI" / "getvar" deseni geçen dosya    : 0
KargoLab'dan alınan alan                        : pdf / base64  (ZPL değil)
/api/labels/[id] servis başlığı                 : Content-Type: application/pdf
```

Etiket akışı uçtan uca **PDF**: KargoLab base64 PDF veriyor, biz `application/pdf`
olarak sunuyoruz, tarayıcı açıp bastırıyor. Hiçbir noktada ZPL üretmiyoruz.
Dolayısıyla bu arıza **kodla düzelmez** — yazıcı/sürücü tarafındadır.

---

## 2 · İki olası kök neden, ayırt etme testiyle

### (a) Yazıcı tanılama (dump) modunda — EN OLASI
Zebra'da `~JD` komutu "Communications Diagnostics" modunu açar. Bu moddayken yazıcı
**gelen her şeyi çalıştırmaz, olduğu gibi basar**. Belirti birebir budur: `~HI` de
`getvar` de metin olarak çıkıyor.

Bu moda kazara girmenin iki yolu var: biri `~JD` gönderilmesi, diğeri açılışta ön
panel/FEED düğmesi kombinasyonuyla tanılama moduna düşülmesi.

**Çıkış:** yazıcıya `~JE` göndermek (bkz. `zebra/01-dump-modundan-cik.zpl`).
Ya da yazıcıyı kapatıp açmak — bazı modellerde dump modu kalıcı olduğundan
kapat-aç yetmeyebilir, `~JE` kesin çözümdür.

### (b) Veri yazıcıya "metin" olarak gidiyor
ZPL'in çalışması için verinin yazıcıya **ham (raw)** ulaşması gerekir. Şu
durumlarda ZPL metin gibi basılır:

- Windows'ta **"Generic / Text Only"** sürücüsü kullanılıyorsa,
- ZPL Not Defteri'nden `Yazdır` ile gönderiliyorsa (sürücü metni sayfaya dizer),
- Yazıcı dili EPL/Line-Print'e ayarlıysa ve ZPL alıyorsa.

**Doğru yol:** Zebra Setup Utilities → *Open Communication With Printer* /
*Send File*, ya da ham yazdırma (`COPY /B dosya.zpl \\bilgisayar\yazici`).

### Ayırt etme
Çıktıya bak: satır başlarında **onaltılık adres/hex sütunları** varsa → (a) dump modu.
Sadece düz komut metni varsa ve hex yoksa → büyük olasılıkla (b) sürücü/gönderim yolu.

---

## 3 · Sıralı uygulama (donanım başındaki kişi)

1. `zebra/01-dump-modundan-cik.zpl` dosyasını **ham** olarak gönder.
2. `zebra/02-yazici-bilgisi.zpl` gönder → yazıcı artık **bir satır bilgi** basmalı
   (model/firmware). Hâlâ komut metni çıkıyorsa sorun (b)'dir, gönderim yolunu değiştir.
3. `zebra/03-test-etiketi.zpl` gönder → düzgün bir test etiketi çıkmalı.
4. Hâlâ olmuyorsa `zebra/04-zpl-diline-al.zpl` (yazıcı dilini ZPL'e sabitler).

> ⚠️ `04` yazıcı ayarını **kalıcı** yazar (`^JUS`). Geri alınabilir ama bilinçli
> yapılmalı. `01`–`03` zararsızdır, ayar yazmaz.

---

## 4 · Üretim akışı için not

Günlük kargo etiketi basımı **ZPL kullanmıyor** — PDF basılıyor. Yani bu arıza
etiket üretimini durdurmaz; yalnız yazıcıya doğrudan ZPL ile tanı koymayı engeller.
Etiket basımında ayrı bir sorun varsa o **başka bir arızadır**, bu belge onu kapsamaz.


---

## Ek ölçüm — 16 Eylül 2026: entegrasyon tarafında ZPL kaldıracı VAR ama PTT'de YOK

Önceki bölüm "biz ZPL üretmiyoruz" diyordu; doğru ama eksikti. KargoLab
**sevkiyat oluşturma** yanıtında hazır ZPL etiketi dönüyor ve biz bunu hiç
kullanmıyoruz. Prod veritabanındaki kayıtlı ham yanıtlardan ölçüldü:

```
metadata->'kargolabResponse'->'courrier_api'->>'zpl'
  → "^XA\r\n^MMT\r\n^PW799\r\n^LL0799\r\n^LS0\r\n^FT360,49^A0N,32,45..."
  uzunluk ~1.9 KB — gerçek, basılabilir Zebra etiketi
```

### KAPSAM — kritik nokta
```
kurye   sevkiyat   zpl var
PTT       101         0      ← canlıda müşteriye sunulan TEK kurye
SÜRAT      11        10
toplam    112        10
```

**ZPL yalnız SÜRAT'ta geliyor, PTT'de hiç yok.** SÜRAT müşteriye kapatıldığı
için bugünkü operasyonun tamamı PTT. Dolayısıyla "depodaki ZPL'i yazıcıya ham
gönderelim" çözümü **şu an hiçbir siparişi kurtarmaz** — dead code olurdu.
(Bu ölçüm yapılmasa o yönde bir yama yazılacaktı; kapsam bakmak kurtardı.)

### İkinci bulgu — kendi etiket yolumuz hiç kullanılmamış
```
fulfillments: 112 kayıt
  metadata ? 'kargolabLabelPdf'  →   0
  label_url IS NOT NULL          →   0
```
Panelde "Etiket linkini al" düğmesi var (`FulfillmentClient.tsx`) ve
`getShipmentLabel`'a bağlı, ama **112 sevkiyatın hiçbirinde etiket saklanmamış**.
Yani bu yol ya hiç kullanılmıyor ya da hep düşüyor. Etiketler büyük olasılıkla
KargoLab'ın kendi panelinden basılıyor — bu doğruysa **bizim kodumuz Zebra
arızasının akışında hiç yok**.

> Bunu doğrulamak için `getShipmentLabel`'ı çağırmadım: KargoLab'da etiket
> üretmek yan etkili olabilir (barkod tüketimi / "basıldı" damgası). Teyit
> Yunus'a tek soruyla yapılır: *"Etiketi KargoLab panelinden mi basıyorsun,
> yoksa bizim panelden 'Etiket linkini al' ile mi?"*

### Hüküm (değişmedi, ama artık daha dar)
PTT etiketi ZPL olarak gelmediğine göre Zebra'ya giden şey PDF'tir; `~HI` ve
`getvar`'ın düz metin basılması hâlâ **yazıcı/sürücü tarafı** bir durumdur —
en olası neden tanılama (dump) modu. `zebra/` klasöründeki sıralı onarım
dosyaları geçerliliğini koruyor.
