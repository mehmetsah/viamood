# #995628 · FAQPage JSON-LD — sahip kararı (Mehmet, 1 Kas 10:00): «Google SSS'i yapısal veri olarak okur; görünen sayfa HİÇ değişmez».
# Tek dosya: snippets/via-product-tabs.liquid. `window.__vmSSS` satırının HEMEN ARDINA, AYNI `{%- if vm_sss != blank … -%}`
# korumasının İÇİNE ve AYNI `vm_sss` kaynağından (ürün metafield'ı custom.sss) bir <script type="application/ld+json"> eklenir.
# · Kaynak tektir: metafield yalnız acik=true SSS satırlarını taşır (admin senkronu src/lib/actions/urun-sss.ts:77 ve
#   scripts/sss-dusur.mts yalnız açık satırları yazar) — vitrin API'si (api/v1/urun-sss/route.ts:39) ile aynı küme.
# · SSS'i olmayan üründe blok HİÇ basılmaz; soru ya da cevabı boş satır atlanır; geçerli satır sayısı 0 ise script yok.
# · Metin `| json` süzgeciyle kaçışlanır (tırnak, ters bölü, kontrol karakterleri); başka hiçbir satır değişmez.
ANAHTAR = 'snippets/via-product-tabs.liquid'
CAPA = '<script>window.__vmSSS = {{ vm_sss | json }};</script>\n'
BLOK = (
    "{%- comment -%} #995628 FAQPage JSON-LD — aynı vm_sss kaynağı (metafield custom.sss = yalnız açık SSS); görünür yüzey değişmez. {%- endcomment -%}\n"
    "{%- assign vm_faq_n = 0 -%}{%- for vm_q in vm_sss -%}{%- if vm_q.soru != blank and vm_q.cevap != blank -%}{%- assign vm_faq_n = vm_faq_n | plus: 1 -%}{%- endif -%}{%- endfor -%}\n"
    "{%- if vm_faq_n > 0 -%}\n"
    '<script type="application/ld+json" data-vm-faq>{"@context":"https://schema.org","@type":"FAQPage","mainEntity":['
    "{%- assign vm_faq_i = 0 -%}{%- for vm_q in vm_sss -%}{%- if vm_q.soru != blank and vm_q.cevap != blank -%}"
    "{%- if vm_faq_i > 0 -%},{%- endif -%}"
    '{"@type":"Question","name":{{ vm_q.soru | json }},"acceptedAnswer":{"@type":"Answer","text":{{ vm_q.cevap | json }} } }'
    "{%- assign vm_faq_i = vm_faq_i | plus: 1 -%}{%- endif -%}{%- endfor -%}"
    "]}</script>\n"
    "{%- endif -%}\n"
)

def uygula(k, v):
    if k != ANAHTAR: raise ValueError('bilinmeyen dosya ' + k)
    if v.count(CAPA) != 1: raise ValueError('çapa tam bir kez geçmiyor')
    if 'FAQPage' in v: raise ValueError('FAQPage zaten var')
    return v.replace(CAPA, CAPA + BLOK)

if __name__ == '__main__':
    import hashlib, json, os
    B = os.path.dirname(os.path.abspath(__file__)); f = ANAHTAR.replace('/', '__')
    o = open(f'{B}/ONCESI/{f}', encoding='utf-8').read(); s = uygula(ANAHTAR, o)
    os.makedirs(f'{B}/SONRASI', exist_ok=True); open(f'{B}/SONRASI/{f}', 'w', encoding='utf-8').write(s)
    m = lambda x: hashlib.md5(x.encode()).hexdigest()
    json.dump({ANAHTAR: {'once': m(o), 'sonra': m(s)}}, open(f'{B}/md5.json', 'w'), indent=1); print(m(o), '→', m(s))
