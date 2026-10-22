#!/usr/bin/env python3
"""#994887 — ViaMood tema KAYNAK İZİ yaması (tekrarlanabilir, deterministik).

Üç dosya:
  snippets/via-kaynak-izi.liquid  YENİ — via-kaynak-izi.js'in <script> sarmalı (bayt bayt)
  layout/theme.liquid             {{ content_for_header }} satırından ÖNCE render satırı
  sections/via-checkout.liquid    buildPayload() gövdesine `kaynak:` alanı

Her çapa TAM 1 KEZ eşleşmek ZORUNDA; aksi hâlde betik durur (sessiz yanlış yama yok).
Zaten yamalı içerik (işaret var) yeniden yamanmaz — çift ekleme olmaz.
Kullanım: python3 yama.py <ONCESI_dizini> <SONRASI_dizini>
"""
import hashlib, json, os, sys

BURASI = os.path.dirname(os.path.abspath(__file__))
ISARET = "#994887"

def snippet():
    js = open(os.path.join(BURASI, "via-kaynak-izi.js"), encoding="utf-8").read()
    return "<script>\n" + js + "</script>\n"

YAMA = {
  "layout/theme.liquid": [
    ("    {{ content_for_header }}\n",
     "    {%- comment -%}#994887 trafik kaynagi (UTM/yonlendiren) — content_for_header'dan ONCE{%- endcomment -%}\n"
     "    {% render 'via-kaynak-izi' %}\n"
     "    {{ content_for_header }}\n"),
  ],
  "sections/via-checkout.liquid": [
    ("  function buildPayload(cart){\n    var inv = (root.querySelector('input[name=\"vco_invoice\"]:checked')||{}).value || 'bireysel';\n    return {\n",
     "  function buildPayload(cart){\n    var inv = (root.querySelector('input[name=\"vco_invoice\"]:checked')||{}).value || 'bireysel';\n    return {\n"
     "      kaynak: (window.viaKaynak && window.viaKaynak.oku()) || null, /* #994887 trafik kaynagi */\n"),
  ],
}

def uygula(key, metin):
    if ISARET in metin:
        raise SystemExit(f"DUR {key}: zaten yamali ({ISARET} var)")
    for eski, yeni in YAMA[key]:
        n = metin.count(eski)
        if n != 1:
            raise SystemExit(f"DUR {key}: capa {n} kez (1 beklenirdi): {eski[:60]!r}")
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
        b = uygula(key, a)
        open(os.path.join(sonra, fn), "w", encoding="utf-8").write(b)
        rapor[key] = {"once": [len(a.encode()), md5(a)], "sonra": [len(b.encode()), md5(b)]}
    s = snippet()
    open(os.path.join(sonra, "snippets__via-kaynak-izi.liquid"), "w", encoding="utf-8").write(s)
    rapor["snippets/via-kaynak-izi.liquid"] = {"once": None, "sonra": [len(s.encode()), md5(s)]}
    print(json.dumps(rapor, indent=1, ensure_ascii=False))
