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
