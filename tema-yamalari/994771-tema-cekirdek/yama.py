#!/usr/bin/env python3
"""#994771 — ViaMood tema ÇEKİRDEĞİ 4px ızgara yaması (tekrarlanabilir, deterministik).

Her değişiklik (eski -> yeni) dosyada TAM 1 KEZ eşleşmek ZORUNDA; aksi hâlde betik durur.
Aynı betik hem yerelde (ONCESI -> SONRASI üretimi) hem sunucuda (canlı GET -> PUT) koşar;
iki tarafta da çıktı md5'i aynı olmalı (beklenen md5'ler BEKLENEN içinde çivilidir).

Eşit uzaklık kuralı (#994771, ŞAH): değer iki ızgara noktasına eşit uzaksa BÜYÜK olan
seçilir (nefes yönü); değilse EN YAKIN. İstisna: işlevi bozulacaksa (outline payı) gerekçe yazılır.
Kullanım: python3 yama.py <ONCESI_dizini> <SONRASI_dizini>
"""
import hashlib, json, os, sys

DAR_DUGME = """  padding: 14px 28px !important;
}
"""
DAR_DUGME_YENI = DAR_DUGME + """
/* #994771 4px izgara — DAR KAPSAM. Yukaridaki global dugme kurali (14px) bilerek
   DEGISMEDI: site genelindeki tum dugmeleri etkilerdi. Yalniz urun sayfasinda olculen
   bilesen dugmeleri 16px'e oturtuldu (yatay 28px zaten izgarada). Ozgulluk (0,2,1):
   global listedeki en ozgul secici button[type=submit]:not(.field__button) ile esit,
   sonra geldigi icin kazanir. */
button.button.add-to-cart-button,
button.button.slideshow-control,
button.button.dialog-zoomed-gallery__close-button,
button.button.dialog-thumbnails-list__thumbnail {
  padding-top: 16px !important;
  padding-bottom: 16px !important;
}
"""

YAMA = {
  "assets/empire-overrides.css": [
    (DAR_DUGME, DAR_DUGME_YENI),
  ],
  "assets/base.css": [
    ("  justify-content: center;\n  gap: 0.3rem;\n}\n\n.add-to-cart__added-icon {",
     "  justify-content: center;\n  gap: 4px; /* #994771 4px izgara: 0.3rem = 4.8px idi */\n}\n\n.add-to-cart__added-icon {"),
    ("form.payment-terms {\n  padding-top: 0.5em;\n",
     "form.payment-terms {\n  padding-top: 8px; /* #994771 4px izgara: 0.5em = 7px idi */\n"),
    ("product-price.text-block:is(.h1, .h2, .h3, .h4, .h5, .h6) > *:not(.tax-note) {\n  margin-block: 0;\n}\n",
     "product-price.text-block:is(.h1, .h2, .h3, .h4, .h5, .h6) > *:not(.tax-note) {\n  margin-block: 0;\n}\n\n"
     "/* #994771 4px izgara — vergi notu baslik olcekli fiyat blogunda .text-block.h4 > * kuralindan\n"
     "   margin-block: var(--font-h4--spacing) = 0.25em = 3.5px aliyordu. Global tipografi kurali\n"
     "   DEGISMEDI; yalniz bu oge 4px'e oturtuldu. Ozgulluk (0,3,1) > (0,2,0). */\n"
     "product-price.text-block:is(.h1, .h2, .h3, .h4, .h5, .h6) > .tax-note {\n  margin-block: 4px;\n}\n"),
  ],
  "snippets/quantity-selector.liquid": [
    ("    flex-wrap: wrap;\n    gap: calc(var(--gap-sm) / 2);\n",
     "    flex-wrap: wrap;\n    gap: 8px; /* #994771 4px izgara: calc(var(--gap-sm) / 2) = 6px idi */\n"),
  ],
  "snippets/sku.liquid": [
    (".sku-line{display:inline-flex;align-items:center;gap:6px}",
     ".sku-line{display:inline-flex;align-items:center;gap:8px}"),
  ],
  "snippets/predictive-search-products-list.liquid": [
    ("padding-top: 16px; margin-top: 10px; }",
     "padding-top: 16px; margin-top: 12px; }"),
  ],
  "snippets/predictive-search-styles.liquid": [
    ("    /* Make space for the outline to be visible */\n    padding-block-start: var(--border-width-sm);\n",
     "    /* Make space for the outline to be visible */\n"
     "    /* #994771 4px izgara: var(--border-width-sm) = 1px idi. En yakin izgara noktasi 0 ama\n"
     "       outline payini yok ederdi (yukaridaki yorum) => islev geregi 4px. */\n"
     "    padding-block-start: 4px;\n"),
  ],
  "snippets/via-kargo-sayaci.liquid": [
    ("    display:flex; align-items:center; gap:14px;\n    padding:14px 16px; border-radius:16px;\n",
     "    display:flex; align-items:center; gap:16px;\n    padding:16px; border-radius:16px;\n"),
    ("    padding:10px 14px; font-weight:800; font-size:19px;\n",
     "    padding:12px 16px; font-weight:800; font-size:19px;\n"),
    ("    .vks{ gap:11px; padding:12px 13px; font-size:14px; }\n",
     "    .vks{ gap:12px; padding:12px; font-size:14px; }\n"),
    ("    .vks__sayac{ font-size:17px; padding:9px 11px; }\n",
     "    .vks__sayac{ font-size:17px; padding:8px 12px; }\n"),
  ],
  "assets/via-mobile-app.css": [
    ("  [class*=\"product-information\"] {\n    padding-bottom: 110px !important;\n",
     "  [class*=\"product-information\"] {\n    padding-bottom: 112px !important; /* #994771 4px izgara: 110 idi */\n"),
    ("    display: flex !important;\n    gap: 6px !important;\n    padding: 8px 0 !important;\n    overflow-x: auto !important;\n",
     "    display: flex !important;\n    gap: 8px !important; /* #994771 4px izgara: 6 idi */\n    padding: 8px 0 !important;\n    overflow-x: auto !important;\n"),
    ("    margin: 14px 0 0 !important;\n    padding: 0 !important;\n    box-shadow: none !important;\n    border-top: 0 !important;\n    display: flex !important;\n    gap: 10px !important;\n",
     "    margin: 16px 0 0 !important; /* #994771 4px izgara: 14 idi */\n    padding: 0 !important;\n    box-shadow: none !important;\n    border-top: 0 !important;\n    display: flex !important;\n    gap: 12px !important; /* #994771 4px izgara: 10 idi */\n"),
  ],
  "assets/via-product-overrides.css": [
    ("opacity:.62;margin:0 0 3px;line-height:1.2}",
     "opacity:.62;margin:0 0 4px;line-height:1.2}"),
    ("@@SON@@", "\n/* #994771 4px izgara — urun detay grubunun ust dolgusu temada max(20px, scale*32px):\n"
     "   mobil/tablette (scale .7) 22.4px. Ayar degeri korunur, yalniz 4px'e yuvarlanir\n"
     "   (PC 32 -> 32 degismez, mobil 22.4 -> 24). round() desteklemeyen tarayici bildirimi\n"
     "   yok sayar ve eski degere duser (zararsiz). Ozgulluk (0,3,0) > .spacing-style (0,1,0). */\n"
     ".product-details > .group-block.spacing-style {\n"
     "  padding-block-start: calc(round(nearest, var(--padding-block-start), 4px) + var(--section-top-offset, 0px));\n"
     "}\n"),
  ],
  "templates/product.json": [
    ("@@HEPSI4@@\"gap\": 10,", "\"gap\": 12,"),
  ],
}

def uygula(key, metin):
    for eski, yeni in YAMA[key]:
        if eski == "@@SON@@":
            metin = metin + yeni; continue
        if eski.startswith("@@HEPSI4@@"):
            e = eski[len("@@HEPSI4@@"):]
            n = metin.count(e)
            if n != 4: raise SystemExit(f"DUR {key}: '{e}' 4 kez beklenirdi, {n} bulundu")
            metin = metin.replace(e, yeni); continue
        n = metin.count(eski)
        if n != 1: raise SystemExit(f"DUR {key}: eslesme {n} (1 beklenirdi): {eski[:60]!r}")
        metin = metin.replace(eski, yeni)
    return metin

if __name__ == "__main__":
    once, sonra = sys.argv[1], sys.argv[2]
    os.makedirs(sonra, exist_ok=True)
    rapor = {}
    for key in YAMA:
        fn = key.replace("/", "__")
        a = open(os.path.join(once, fn), encoding="utf-8").read()
        b = uygula(key, a)
        if key.endswith(".json"): json.loads(b)  # sessiz bozulma olmasin
        open(os.path.join(sonra, fn), "w", encoding="utf-8").write(b)
        rapor[key] = {"once": [len(a.encode()), hashlib.md5(a.encode()).hexdigest()],
                      "sonra": [len(b.encode()), hashlib.md5(b.encode()).hexdigest()]}
    print(json.dumps(rapor, indent=1, ensure_ascii=False))
