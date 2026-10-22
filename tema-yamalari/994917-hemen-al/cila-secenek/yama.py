#!/usr/bin/env python3
"""#994917 cila — tek varyantlı üründe WhatsApp mesajına "Seçenek: Default Title" sızıntısı.

ÖLÇÜLEN KÖK NEDEN (22 Eki 2026, katalog 445 ürün): 444 tek varyantlı üründen 105'inin seçenek ADI
"Title" değil "Default Title" → Shopify `product.has_only_default_variant` = false döner, snippet ürünü
çok varyantlı sanıp "Seçenek: Default Title" yazıyordu (Liquid yedek href + JS viaWaMesaj, iki yer).
Kural: varyant başlığı (kırpılmış, büyük/küçük harf duyarsız) "default title" ya da "varsayılan başlık"
ise Seçenek satırı YAZILMAZ. Çok varyantlı üründe satır aynen kalır. ?variant= linkine DOKUNULMADI.
⚠ Normalleştirme: küçült + 'ı'→'i' (iki tarafta da). toLowerCase/downcase "VARSAYILAN"ı "varsayilan" yapar (noktalı i);
  toLocaleLowerCase('tr-TR') ise "Default Title"ı "default tıtle" yapar — ikisi de ham karşılaştırmayı kırar (birim sınamasında ölçüldü).
Her çapa TAM 1 kez; aksi hâlde DUR.  Kullanım: python3 yama.py <ONCESI> <SONRASI>
"""
import hashlib, json, os, sys

L1 = ("      unless product.has_only_default_variant\n"
      "        assign wa_mesaj = wa_mesaj | append: nl | append: 'Seçenek: ' | append: secili.title\n"
      "      endunless")
L1Y = ("      assign secenek_ad = secili.title | strip | downcase | replace: 'ı', 'i'\n"
       "      unless product.has_only_default_variant or secenek_ad == 'default title' or secenek_ad == 'varsayilan başlik'\n"
       "        assign wa_mesaj = wa_mesaj | append: nl | append: 'Seçenek: ' | append: secili.title\n"
       "      endunless")
J1 = "          if (!d.tekVaryant) sat.push('Seçenek: ' + v.baslik);"
J1Y = ("          var secAd = String(v.baslik || '').trim().toLowerCase().replace(/ı/g, 'i');\n"
       "          if (!d.tekVaryant && secAd !== 'default title' && secAd !== 'varsayilan başlik') sat.push('Seçenek: ' + v.baslik);")

YAMA = {'snippets/via-satinal-ek.liquid': [('liquid-yedek', L1, L1Y), ('js-viaWaMesaj', J1, J1Y)]}

def uygula(key, metin):
    for par, eski, yeni in YAMA[key]:
        n = metin.count(eski)
        if n != 1:
            raise SystemExit(f"DUR {key} {par}: eslesme {n} (1 beklenirdi): {eski[:60]!r}")
        metin = metin.replace(eski, yeni)
    return metin

if __name__ == "__main__":
    once, sonra = sys.argv[1], sys.argv[2]
    os.makedirs(sonra, exist_ok=True)
    md5 = lambda s: hashlib.md5(s.encode()).hexdigest()
    rapor = {}
    for key in YAMA:
        fn = key.replace("/", "__")
        a = open(os.path.join(once, fn), encoding="utf-8").read()
        sayac = {par: a.count(eski) for par, eski, _ in YAMA[key]}
        b = uygula(key, a)
        open(os.path.join(sonra, fn), "w", encoding="utf-8").write(b)
        rapor[key] = {"count": sayac, "once": [len(a.encode()), md5(a)], "sonra": [len(b.encode()), md5(b)]}
    print(json.dumps(rapor, indent=1, ensure_ascii=False))
