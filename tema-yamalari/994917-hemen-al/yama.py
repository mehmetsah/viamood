#!/usr/bin/env python3
"""#994917 · ayse:730 · m7+m8 UYGULAMA — tema yaması (deterministik, tekrarlanabilir).

Çapalar r4'ün İMZALI dosyasından (raporlar/994917-kanit/sah-r4/r4-capalar.py, md5 0138dc44…; md.31
ŞAH %100 21:33 + Ayşe %100 21:39) BİREBİR kopyalandı — aşağıdaki "r4 GÖVDESİ" bloğu o dosyanın
import'tan __main__'e kadar olan kısmıdır, elle değiştirilmedi.
EK (brif 3c, Ayşe onaylı): whatsapp-sticky.liquid SEPET mesajındaki iki 🛒 (\\ud83d\\uded2) temizlenir.
EK (§5.4): assets/via-product-overrides.css SONUNA r3 CSS bloğu (YENI/r3-blok.css, md5 4978434f…) BİREBİR.
YENİ dosya: snippets/via-satinal-ek.liquid (YENI/).
Her eşleşme dosyada TAM 1 KEZ bulunmak ZORUNDA; aksi hâlde betik DURUR.
Kullanım: python3 yama.py <ONCESI_dizini> <SONRASI_dizini>
"""
# ── r4 GÖVDESİ (imzalı, birebir) ─────────────────────────────────────────────
import hashlib, json, os, sys

# §5.2 — form içinde, .product-form-buttons kapanan </div>'den hemen SONRA, gift_card </span>'ından ÖNCE
C52 = ('        </div>\n'
       '        {%- if block_settings.gift_card_form and product.gift_card? -%}\n'
       '          </span>\n'
       '        {%- endif -%}\n'
       '      {%- endform -%}')
Y52 = ('        </div>\n'
       "        {%- render 'via-satinal-ek', product: product, variant: variant, can_add_to_cart: can_add_to_cart, form_id: product_form_id -%}\n"
       '        {%- if block_settings.gift_card_form and product.gift_card? -%}\n'
       '          </span>\n'
       '        {%- endif -%}\n'
       '      {%- endform -%}')

# §5.3 — sabit çubuk: Sepete ekle düğmesinin ÖNÜNE (açılış ÇOK SATIRLI; r3'teki tek satırlık çapa 0 eşleşiyordu)
C53 = ('      <button\n'
       '        type="button"\n'
       '        class="sticky-add-to-cart__button add-to-cart-button button"')
Y53 = ('      <button\n'
       '        type="button"\n'
       '        class="sticky-add-to-cart__hemen via-hemen-al"\n'
       '        data-via-hemen-al\n'
       '        {% unless current_variant.available %}\n'
       '          disabled\n'
       '        {% endunless %}\n'
       '      >\n'
       '        Hemen al\n'
       '      </button>\n'
       '\n' + C53)

# §5.5a — whatsapp-sticky.liquid JS: ürün sayfasında viaWaMesaj SEPETTEN ÖNCE
C55a = ('      var msg = null;\n'
        '      if (c && c.items && c.items.length) {')
Y55a = ('      var msg = null;\n'
        "      if (location.pathname.indexOf('/products/') !== -1 && typeof window.viaWaMesaj === 'function') {\n"
        '        msg = window.viaWaMesaj();\n'
        '      } else if (c && c.items && c.items.length) {')

# §5.5b — footer-group.json: opt_siparis → cart_aware:true + mesajdan 🛒 çıkar (JSON kaçışları dosyadaki gibi)
C55b = '            "message": "Merhaba, sipariş vermek istiyorum 🛒\\nÜrün: \\nAdet: \\nTeslimat adresi: "\n'
Y55b = ('            "message": "Merhaba, sipariş vermek istiyorum\\nÜrün: \\nAdet: \\nTeslimat adresi: ",\n'
        '            "cart_aware": true\n')

# §5.6 — çok al: vqb__btn kapanışından hemen SONRA, </quantity-break>'ten ÖNCE
C56 = '  </button>\n</quantity-break>'
Y56 = "  </button>\n  {%- render 'via-satinal-ek', product: product, kip: 'vqb' -%}\n</quantity-break>"

YAMA = {
    'blocks/buy-buttons.liquid':           [('§5.2', C52, Y52)],
    'sections/product-information.liquid': [('§5.3', C53, Y53)],
    'sections/whatsapp-sticky.liquid':     [('§5.5a', C55a, Y55a)],
    'sections/footer-group.json':          [('§5.5b', C55b, Y55b)],
    'blocks/via-cok-al.liquid':            [('§5.6', C56, Y56)],
}

# ── r4 GÖVDESİ SONU ──────────────────────────────────────────────────────────

BURASI = os.path.dirname(os.path.abspath(__file__))
def ek(ad): return open(os.path.join(BURASI, "YENI", ad), encoding="utf-8").read()

# brif 3c — emoji tutarlılığı (r4 sonrası satır 239 ve 242); her dize bağlamıyla TEK
E1 = "vermek istiyorum \\ud83d\\uded2\\n' + lines.join"
E1Y = "vermek istiyorum\\n' + lines.join"
E2 = "etmek istiyorum \\ud83d\\uded2\\n' + t +"
E2Y = "etmek istiyorum\\n' + t +"
YAMA['sections/whatsapp-sticky.liquid'] += [('3c-1', E1, E1Y), ('3c-2', E2, E2Y)]
YAMA['assets/via-product-overrides.css'] = [('§5.4', '@@SON@@', None)]
YENI_DOSYA = {'snippets/via-satinal-ek.liquid': 'snippets__via-satinal-ek.liquid'}

def uygula(key, metin):
    for par, eski, yeni in YAMA[key]:
        if eski == '@@SON@@':
            metin = metin + ek('r3-blok.css'); continue
        n = metin.count(eski)
        if n != 1:
            raise SystemExit(f"DUR {key} {par}: eslesme {n} (1 beklenirdi): {eski[:60]!r}")
        metin = metin.replace(eski, yeni)
    if key.endswith('.json'):
        json.loads(metin)
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
        open(os.path.join(sonra, fn), "w", encoding="utf-8").write(b)
        rapor[key] = {"once": None, "sonra": [len(b.encode()), md5(b)]}
    print(json.dumps(rapor, indent=1, ensure_ascii=False))
