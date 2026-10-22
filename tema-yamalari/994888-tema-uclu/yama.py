#!/usr/bin/env python3
"""#994888 — ViaMood tema üçlüsü yaması (tekrarlanabilir, deterministik).

m8: templates/product.json → temanın YERLEŞİK variant-picker bloğu (buttons) fiyat bloğundan
    hemen sonra (Ayşe'nin 10 Eki varyasyon-seçici kararının yüzeyi; via-cok-al.liquid'e DOKUNULMAZ).
m2: layout/theme.liquid → yalnız request.page_type == 'policy' iken snippets/via-politika-baslik.liquid;
    assets/via-product-overrides.css → #994888 m2 bloğu (via-legal-page .vl-* kurallarının kopyası).

Her eşleşme dosyada TAM 1 KEZ bulunmak ZORUNDA; aksi hâlde betik DURUR (sessiz yanlış yama yok).
Kullanım: python3 yama.py <ONCESI_dizini> <SONRASI_dizini> [YENI_dizini]
"""
import hashlib, json, os, sys

BURASI = os.path.dirname(os.path.abspath(__file__))

M8_BLOK = '''            "variant_picker_m8": {
              "type": "variant-picker",
              "settings": {
                "variant_style": "buttons",
                "show_swatches": true,
                "alignment": "left",
                "padding-block-start": 0,
                "padding-block-end": 8,
                "padding-inline-start": 0,
                "padding-inline-end": 0
              },
              "blocks": {}
            },
            "vm_rozetler": {'''

LAYOUT_ESKI = '''      {{ content_for_layout }}
    </main>'''
LAYOUT_YENI = '''      {%- comment -%} #994888 m2: politika sayfasinda yasal baslik (snippets/via-politika-baslik.liquid) {%- endcomment -%}
      {% if request.page_type == 'policy' %}
        {% render 'via-politika-baslik', icerik: content_for_layout %}
      {% else %}
        {{ content_for_layout }}
      {% endif %}
    </main>'''

def ek(ad):
    return open(os.path.join(BURASI, "YENI", ad), encoding="utf-8").read()

YAMA = {
  "templates/product.json": [
    ('''            "vm_rozetler": {''', M8_BLOK),
    ('''            "price_a7krng",
            "vm_rozetler",''', '''            "price_a7krng",
            "variant_picker_m8",
            "vm_rozetler",'''),
  ],
  "layout/theme.liquid": [
    (LAYOUT_ESKI, LAYOUT_YENI),
  ],
  "assets/via-product-overrides.css": [
    ("@@SON@@", None),  # YENI/m2-ek.css (+ varsa YENI/m8-ek.css) sona eklenir
  ],
}
YENI_DOSYA = {"snippets/via-politika-baslik.liquid": "snippets__via-politika-baslik.liquid"}

def uygula(key, metin):
    for eski, yeni in YAMA[key]:
        if eski == "@@SON@@":
            eklenti = ek("m2-ek.css")
            if os.path.exists(os.path.join(BURASI, "YENI", "m8-ek.css")):
                eklenti += ek("m8-ek.css")
            metin = metin + eklenti
            continue
        n = metin.count(eski)
        if n != 1:
            raise SystemExit(f"DUR {key}: eslesme {n} (1 beklenirdi): {eski[:60]!r}")
        metin = metin.replace(eski, yeni)
    if key.endswith(".json"):
        json.loads(metin)  # sessiz bozulma olmasin
    return metin

if __name__ == "__main__":
    once, sonra = sys.argv[1], sys.argv[2]
    os.makedirs(sonra, exist_ok=True)
    md5 = lambda s: hashlib.md5(s.encode()).hexdigest()
    rapor = {}
    for key in YAMA:
        fn = key.replace("/", "__")
        a = open(os.path.join(once, fn), encoding="utf-8").read()
        b = uygula(key, a)
        open(os.path.join(sonra, fn), "w", encoding="utf-8").write(b)
        rapor[key] = {"once": [len(a.encode()), md5(a)], "sonra": [len(b.encode()), md5(b)]}
    for key, fn in YENI_DOSYA.items():
        b = ek(fn)
        open(os.path.join(sonra, key.replace("/", "__")), "w", encoding="utf-8").write(b)
        rapor[key] = {"once": None, "sonra": [len(b.encode()), md5(b)]}
    print(json.dumps(rapor, indent=1, ensure_ascii=False))
