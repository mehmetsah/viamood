# #995986 k3b · kazanç rozetinin yeri · basım kanıtı — 22 Kas 2026 21:30 TSİ

- **Talep:** Yunus 22 Kas: «Ürün detay sayfasında yeşil "Kazancınız 250TL" rozeti şu an ürün adının
  ÜSTÜNDE. Bunu fiyatın altındaki "Vergiler dahildir." yazısının hemen ALTINA taşı.»
  Örnek ürün: 132 — `etiketli-18li-antrasit-ekonomik-kirilmaz-saklama-kabi-seti-x6-175-12-05-lt` (750 → 500).

- **Yama (iki dosya, iki çapa):**
  - `templates/product.json` `7ee2e9d9` → `17a4b18a`: YALNIZ
    `sections.main.blocks.product-details.block_order` — `via_kazanc` baştan alınıp
    `price_a7krng`'in HEMEN ardına kondu. Saf sıralama → **bayt sayısı değişmedi** (27 689).
    `blocks.via_kazanc` tanımı yerinde bırakıldı, böylece JSON fark kümesi TEK yola indi.
  - `blocks/via-kazanc.liquid` `36a44558` → `a0e656e7`: `variant:update` geri-düşümü.
    Rozet DOM'da yokken eski kod onu BAŞLIK bloğunun önüne sokuyordu (taşımadan sonra yanlış yer).
    Artık önce `<product-price>`'ın ardına konur; eski `h1` yolu YEDEK olarak kaldı →
    `product-price`'ı olmayan `cok-al` şablonunda davranış değişmedi.
    Tutar hesabı, rozet çıktı satırı, `{% stylesheet %}` ve `{% schema %}` **bayt bayt** korundu
    (yama kapıları bunu doğruluyor); renk kümesi hâlâ `#1c6b45` + `#fff`.
  - **CSS değişmedi.** `via-kazanc`, `assets/via-product-overrides.css`'de (53 763 bayt) hiç geçmiyor;
    stil bloğun kendi `{% stylesheet %}`'inde ve konumdan bağımsız (`align-self: flex-start`).

- **`product.cok-al.json` DEĞİŞMEDİ.** Orada «Vergiler dahildir.» `via-cok-al.liquid`'in İÇİNDE
  (`.vqb__vat`, satır 41), adet kartlarının üstünde — kardeş blok `block_order` ile oraya giremez.
  O şablonu `cok-al` ekiyle TEK ürün kullanıyor (1250 üründen 1249'u `product.json`;
  `30-lt-saklama-kutusu-cok-al-az-ode`) ve o üründe seçili varyantta indirim olmadığı için rozet
  hâlen hiç basılmıyor (canlı DOM'da «Kazancınız» yok). Rozet orada başlığın üstünde kalıyor.

- **Hedefin ölçümü (neden `price_a7krng`'ten hemen sonra):** `.tax-note`, `<product-price>`'ın son
  GÖRÜNÜR öğesi. Ardındaki `.installments`, canlı çıktıda içi boş bir `<form class="payment-terms">`
  basıyor (`payment_terms` görünür metin üretmiyor) ve `base.css`'te
  `product-price.text-block:is(.h1…h6) > *:not(.tax-note){margin-block:0}` ile marjı da sıfır.

- **Kapılar ve basım:** `KURU=1` → `ON-KAPI OK` ×2, `KURU: PUT YOK`.
  ÖNİZLEME teması `198031409284` (`UNPUBLISHED`, canlının kopyası) → PUT 200 ×2, GET-back OK;
  Yunus masaüstü ve telefonda kontrol etti, rozet doğru yerde (onay 22 Kas).
  CANLI `195348856964` → PUT 200 ×2, GET-back OK.

- **Canlı GET-back / bağımsız doğrulama** (basımdan sonra, ayrı GET ile):

  | Dosya | canlı md5 | beklenen (SONRASI) | CR |
  |---|---|---|---|
  | `blocks/via-kazanc.liquid` | `a0e656e799129b9c20312897470dbaf0` | aynı | yok |
  | `templates/product.json` | `17a4b18ae5816160849a299ab3a1922e` | aynı | yok |

- **Canlı sayfa ölçümü** (ürün 132, `preview_theme_id` YOK, ham HTML ofsetleri):
  `<h1>` 325 515 · `.tax-note` 326 669 · `.via-kazanc` 327 378 → rozet hem başlıktan hem
  «Vergiler dahildir.»dan SONRA. Ham sıra:
  `…<div class="tax-note">Vergiler dahildir.</div> <div class="installments"><form …/></div></product-price> <p class="via-kazanc" data-via-kazanc>Kazancınız 250TL</p>`

- **Geri alma:** `python tema-yamalari/yerel-bas.py 995986-k3b-rozet-yeri KIP=GERI TEMA_ID=195348856964`
  (ters sırayla ÖNCESİ'ne döner; `ZATEN-ONCESI` atlar, ikisi de değilse `DUR: ne oncesi ne sonrasi`).

- **Yeni yöntem:** basım bu bilgisayarda `python tema-yamalari/yerel-bas.py <paket> …` ile koştu.
  Eski `calistir.sh` + AWS SSM (`ssm2.sh`) yolu KULLANILMADI; bu pakette `calistir.sh` yok.
  Kimlik repo kökündeki `.env.local`'den yalnız alt sürecin ortam değişkeni olarak geçti,
  hiçbir çıktıya yazılmadı.

- **LF:** depoda `core.autocrlf=true` olduğu için çalışma kopyası CRLF düşüyordu (git blob'ları LF).
  Kök `.gitattributes` (`tema-yamalari/** text eol=lf`) checkout'u sabitledi — commit edilen içerik
  DEĞİŞMEDİ. `yama.py` okuma/yazmayı ikili kipte yapıyor, `bas.py` her PUT'tan önce `'\r'` kapısından
  geçiyor. Canlıya giden iki dosyada da CR yok (yukarıda ölçüldü).

- **Test:** `tests/tema-995986-k3b-rozet-yeri.test.ts` (7 iddia; md5 zinciri `k1 → k3 → k3b`,
  block_order, `cok-al` dokunulmadığı, liquid'in değişmeyen bölümleri, `yama.py` kapıları, LF güvencesi).
  `npx vitest run tests/tema-*.test.ts` → 10 dosya / 63 test yeşil.
