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

---

## Ek ölçüm — 7 Ekim 2026: arıza TEKRARLADI (#993107) · neden tekrarladığı bulundu

**Olay:** Yunus, 7 Eki 13:43, fotoğrafla: *"yazıcılardan device product name yazmaya başladı gene"*.
Çıktı birebir iki satır:
```
~HI
! U1 getvar "device.product_name"
```

### Yeni kanıt 1 — iki satır İKİ AYRI DİL, bu teşhisi kesinleştiriyor
`~HI` bir **ZPL** komutudur (Host Identification). `! U1 getvar "..."` ise **CPCL/Link-OS SGD**
söz dizimidir. Link-OS yazıcılar `! U1` SGD sorgusunu **dil kipinden bağımsız** yanıtlar.
⇒ Yazıcı **ikisini birden** düz metin bastıysa sorun "yanlış dil kipi" (aday c) **değildir**:
tek bir dil yanlış olsaydı öbürü yine yorumlanırdı. **Yorumlayıcı hiç çalışmıyor** demektir —
yani **tanılama (dump) modu**, aday **(a)**. Önceki bölümün "en olası" dediği şey artık ölçülü.

### Yeni kanıt 2 — bu dizeleri BİZ göndermiyoruz (7 Eki'de yeniden ölçüldü)
```
src/ + scripts/ içinde "~HI"                 → 0
src/ + scripts/ içinde "getvar"              → 0
src/ + scripts/ içinde "device.product_name" → 0
\bepl\b / \bEPL\b (kelime sınırıyla)        → 0   (önceki "92 dosya" replace/helper yanlış pozitifiymiş)
"zpl" geçen dosya → 2, ikisi de scripts/takip-no-zpl-*.mjs — ZPL'i OKUYOR, yazıcıya GÖNDERMİYOR
```
Etiket akışı hâlâ uçtan uca PDF: `src/app/api/labels/[id]/route.ts:59-63` base64 → Buffer →
`Content-Type: application/pdf`.
⇒ `~HI` + `getvar` ikilisi bir **Zebra keşif/tanıma el sıkışmasıdır** (Browser Print ·
Setup Utilities · sürücü yoklaması). Bizim kodumuzda **yoklama/durum sorgusu yok** —
yani aday **(b) "bizim sorgumuz baskı kuyruğuna karışıyor" da ELENDİ**.

### Neden TEKRARLADI — eksik olan buydu
`01-dump-modundan-cik.zpl` yalnız **`~JE`** gönderiyor. `~JE` **çalışma anı** komutudur:
tanılama modunu kapatır ama **ayarı kalıcı yazmaz**. Yazıcı kapanıp açıldığında ya da
açılışta FEED düğmesi kombinasyonuyla tanılama moduna yeniden düşüldüğünde **arıza geri gelir**.
`04-zpl-diline-al.zpl` kalıcı yazıyor (`^JUS`) ama yalnız **dili** (`^SZ2`) ayarlıyor;
dump modundan çıkışı içermiyor. İkisi **ayrı dosyada** olduğu için operatör genelde
yalnız `01`'i gönderip bırakıyor — tekrarın yapısal sebebi bu.

### Kalıcı onarım — `05-tanilama-kapat-ve-KALICI-yaz.zpl` (YENİ)
Tek gönderimde: tanılama modundan çık **+** dili ZPL'e sabitle **+** ayarı kalıcı yaz.
```
~JE
^XA
^SZ2
^JUS
^XZ
```
⚠ `^JUS` yazıcı ayarını **kalıcı** yazar — geri alınabilir ama bilinçli yapılmalı.
Tekrar eden arızada **`01` yerine `05`** gönderilmeli.

### Yunus'a adım adım (model bilinmiyor — Zebra genel)
1. Yazıcıyı **USB/ağ ile** bilgisayara bağla, **Zebra Setup Utilities**'i aç.
2. *Open Communication With Printer* → **`05-tanilama-kapat-ve-KALICI-yaz.zpl`** içeriğini yapıştır → **Send**.
   (Alternatif ham gönderim: `COPY /B 05-tanilama-kapat-ve-KALICI-yaz.zpl \\bilgisayar\yazici`)
3. `02-yazici-bilgisi.zpl` (`~HI`) gönder → artık **tek satır model/firmware bilgisi** basmalı.
   Hâlâ komut metni çıkıyorsa gönderim yolu metin sürücüsünden geçiyordur (aday b): sürücüyü
   **"Generic / Text Only"**'den çıkar, Zebra ZPL sürücüsüne geç.
4. `03-test-etiketi.zpl` gönder → düzgün test etiketi + barkod çıkmalı.
5. Yazıcıyı **kapat-aç** ve 3. adımı **tekrarla** — kalıcılık böyle doğrulanır.
   (Eski `01` ile bu adım geçilmiyordu; tekrarın yakalanmamasının sebebi buydu.)

### Mehmet'in Yunus'a sorduğu iki soru neden önemli
· **"Her baskıda mı, ilk baskıda mı?"** → her baskıda ise mod kalıcı; yalnız ilk baskıda ise
  keşif el sıkışması baskı kuyruğuna karışıyordur (sürücü/Browser Print ayarı).
· **Yazıcı modeli** → `^SZ2` ve `~JE` tüm ZPL yazıcılarda geçerli; ama ZD/ZT serisinde ön panelden
  *Diagnostics Mode* doğrudan kapatılabilir, model gelince adım sayısı 5'ten 2'ye iner.

### Hüküm
Kök sebep **bizim kodumuzda DEĞİL** — üç adaydan **(a) yazıcı tanılama (dump) modu**.
(b) elendi (bizde yoklama yok), (c) elendi (iki ayrı dil birden basılıyor).
Kod değişikliği **yapılmadı**: olmayan bir kusura kod yazmak yanlış olurdu.
Kalıcı kontrol **operatör tarafında**: `05` dosyası + kapat-aç doğrulama adımı.

