# #995986 · ayse:863 KALEM 2 — «Hemen Al» SOL + «Sepete Ekle» SAĞ yan yana; «WhatsApp ile sipariş ver» DOLGULU (Yunus 6 Kas 08:05).
# Ölçülen (canlı, ürün 132): .product-form-buttons = [adet 130px][Sepete ekle flex 1 1 185px]; Hemen al ve WhatsApp ayrı
# kapta (.via-satinal-ek, buy-buttons.liquid:236) alt satırlarda. Yama — DOM sırası = görsel sıra (sekme sırası da sol→sağ):
#   1) blocks/buy-buttons.liquid: add-to-cart bloğu .via-al-cifti sarmalayıcısına alınır; önüne via-satinal-ek kip 'hemen'.
#      Standart via-satinal-ek çağrısına hemen_ayri: true — Hemen al İKİ KEZ basılmaz.
#   2) snippets/via-satinal-ek.liquid: kip 'hemen' yalnız Hemen al'ı aynı data-via-satinal kabıyla basar (secim/anaForm
#      aynı yolu kullanır); veri adası + betik YALNIZ standart kipte (kip == '') — çift ada yok. Çok al şablonu: kip 'hemen'
#      dugme_ciz=false kuralına takılır, hiçbir şey basmaz (vqb düzeni aynen).
#   3) via-product-overrides.css: çift tek flex öğesi (1 1 260px) — 1280'de adetle aynı satırda, dar ekranda kendi satırına
#      sarılır, iki düğme yine yan yana. WhatsApp: #25D366 (wa-fab'ın kendi değeri) dolgu + mevcut --empire-ink-soft yazı.
#      Beyaz yazı seçilmedi: #25D366 üstünde 1.98:1 (okunmaz); mürekkep 8.8:1. YENİ renk/jeton/yazı ölçüsü YOK.
BB = 'blocks/buy-buttons.liquid'
SE = 'snippets/via-satinal-ek.liquid'
CSS = 'assets/via-product-overrides.css'
SIRA = [CSS, SE, BB]
BB_ATC = ("          {% content_for 'block',\n"
          "            type: 'add-to-cart',\n"
          "            id: 'add-to-cart',\n"
          "            can_add_to_cart: can_add_to_cart,\n"
          "            add_to_cart_text: add_to_cart_text\n"
          "          %}\n")
BB_ATC_YENI = ("          {%- comment -%} #995986 · ayse:863: Hemen al (SOL) + Sepete ekle (SAĞ) tek çiftte; WhatsApp alttaki via-satinal-ek'te. {%- endcomment -%}\n"
               "          <div class=\"via-al-cifti\">\n"
               "            {%- render 'via-satinal-ek', kip: 'hemen', product: product, variant: variant, can_add_to_cart: can_add_to_cart, form_id: product_form_id -%}\n"
               + BB_ATC +
               "          </div>\n")
BB_RENDER = "        {%- render 'via-satinal-ek', product: product, variant: variant, can_add_to_cart: can_add_to_cart, form_id: product_form_id -%}\n"
BB_RENDER_YENI = "        {%- render 'via-satinal-ek', product: product, variant: variant, can_add_to_cart: can_add_to_cart, form_id: product_form_id, hemen_ayri: true -%}\n"
SE_CAGRI = "  Çağrı yerleri: blocks/buy-buttons.liquid (§5.2, standart) · blocks/via-cok-al.liquid (§5.6, kip: 'vqb').\n"
SE_CAGRI_YENI = ("  Çağrı yerleri: blocks/buy-buttons.liquid (§5.2, standart) · blocks/via-cok-al.liquid (§5.6, kip: 'vqb').\n"
                 "  #995986 · ayse:863: buy-buttons.liquid kip 'hemen' → yalnız Hemen al, Sepete ekle'nin SOLUNDA (.via-al-cifti);\n"
                 "  standart çağrı hemen_ayri: true ile Hemen al'ı basmaz. Veri adası + betik yalnız standart kipte (kip == '').\n")
SE_DUGME = "  {%- if dugme_ciz -%}\n"
SE_DUGME_YENI = ("  {%- if kip == 'hemen' -%}\n"
                 "    {%- if dugme_ciz and hemen_var -%}\n"
                 "      <div class=\"via-satinal-ek via-satinal-ek--hemen\" data-via-satinal data-urun=\"{{ product.id }}\"{% if form_id != blank %} data-form-id=\"{{ form_id }}\"{% endif %}>\n"
                 "        <button type=\"button\" class=\"via-hemen-al\" data-via-hemen-al>Hemen al</button>\n"
                 "      </div>\n"
                 "    {%- endif -%}\n"
                 "  {%- elsif dugme_ciz -%}\n")
SE_HEMEN = "      {%- if hemen_var -%}\n        <button type=\"button\" class=\"via-hemen-al\" data-via-hemen-al>Hemen al</button>\n"
SE_HEMEN_YENI = "      {%- if hemen_var and hemen_ayri != true -%}\n        <button type=\"button\" class=\"via-hemen-al\" data-via-hemen-al>Hemen al</button>\n"
SE_ADA = "  {%- if kip != 'vqb' -%}\n    <script type=\"application/json\" data-via-wa-urun"
SE_ADA_YENI = "  {%- if kip == '' -%}\n    <script type=\"application/json\" data-via-wa-urun"
CSS_CAPA = ".via-wa-siparis:hover{border-color:#25D366;background:#f3fdf4}\n"
CSS_EK = ("/* ── #995986 · ayse:863 (Yunus 6 Kas) · Hemen al SOL + Sepete ekle SAĞ yan yana · WhatsApp DOLGULU ──\n"
          "   .via-al-cifti adet seçicinin yanında TEK flex öğesi (1 1 260px): 1280'de adetle aynı satır; dar ekranda\n"
          "   (130 + 12 + 260 > satır) kendi satırına sarılır ve iki düğme yine yan yana kalır (390'da 2 × 149px, 52px yükseklik).\n"
          "   WhatsApp: #25D366 = wa-fab'ın kendi değeri (yukarıdaki not); yazı/ikon mevcut --empire-ink-soft.\n"
          "   Beyaz yazı SEÇİLMEDİ: #25D366 üstünde 1.98:1 okunmaz, mürekkep 8.8:1. Yeni renk/jeton/yazı ölçüsü YOK. */\n"
          ".product-form-buttons .via-al-cifti{display:flex;flex:1 1 260px;gap:12px;min-width:0}\n"
          ".product-form-buttons .via-al-cifti>*{flex:1 1 0;min-width:0}\n"
          ".via-satinal-ek.via-satinal-ek--hemen{display:block;margin:0;width:auto}\n"
          ".via-satinal-ek--hemen .via-hemen-al{padding:0 12px}\n"
          ".via-wa-siparis{background:#25D366;border-color:#25D366;color:var(--empire-ink-soft)}\n"
          ".via-wa-siparis svg{color:currentColor}\n"
          ".via-wa-siparis:hover{background:#25D366;border-color:#25D366;opacity:.92}\n")
CIFTLER = {
    BB: [(BB_RENDER, BB_RENDER_YENI), (BB_ATC, BB_ATC_YENI)],
    SE: [(SE_CAGRI, SE_CAGRI_YENI), (SE_DUGME, SE_DUGME_YENI), (SE_HEMEN, SE_HEMEN_YENI), (SE_ADA, SE_ADA_YENI)],
    CSS: [(CSS_CAPA, CSS_CAPA + CSS_EK)],
}
def denge(s):
    import re
    return len(re.findall(r'\{%-?\s*if\s', s)) - len(re.findall(r'\{%-?\s*endif\s*-?%\}', s))
def uygula(k, v):
    if k not in CIFTLER: raise SystemExit('bilinmeyen dosya ' + k)
    if '#995986' in v: raise SystemExit(f'DUR {k}: #995986 zaten uygulanmış')
    ilk = v
    for e, y in CIFTLER[k]:
        n = v.count(e)
        if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi): {e[:60]!r}')
        v = v.replace(e, y)
    if k in (SE, BB):
        if denge(v) != denge(ilk):
            raise SystemExit(f'DUR {k}: if/endif dengesi değişti ({denge(ilk)} → {denge(v)})')
    return v
if __name__ == '__main__':
    import os, hashlib, json
    B = os.path.dirname(os.path.abspath(__file__)); m = lambda x: hashlib.md5(x.encode()).hexdigest(); md = {}
    os.makedirs(f'{B}/SONRASI', exist_ok=True)
    for k in SIRA:
        f = k.replace('/', '__'); o = open(f'{B}/ONCESI/{f}', encoding='utf-8').read(); s = uygula(k, o)
        open(f'{B}/SONRASI/{f}', 'w', encoding='utf-8').write(s); md[k] = {'once': m(o), 'sonra': m(s)}; print(k, m(o), '->', m(s))
    json.dump(md, open(f'{B}/md5.json', 'w'), ensure_ascii=False, indent=1)
