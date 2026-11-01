# #995714 — footer (Yunus, 1 Kas 2026): (1) sol sütundaki tekrar eden telefon + e-posta kalkar,
# (2) sol sütundaki WA/IG/@ sosyal yuvarlakları (.vf-social) kalkar, (3) adres «Bize Ulaşın» listesinin ALTINA taşınır.
# Üç çapa, her biri count==1; başka satıra dokunulmaz. Artık kullanılmayan .vf-contact-row/.vf-social CSS'i bilinçli olarak yerinde bırakıldı.
ADRES_IKON = '<svg class="vf-ikon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'
SOL_ESKI = (
    '        <div class="vf-contact-row">\n'
    '          <span><svg class="vf-ikon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg><a href="tel:+90{{ company_phone_intl }}">{{ settings.company_phone }}</a></span>\n'
    '          <span><svg class="vf-ikon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg><a href="mailto:{{ settings.company_email }}">{{ settings.company_email }}</a></span>\n'
    '          <span>' + ADRES_IKON + '{{ settings.company_address }}</span>\n'
    '        </div>\n'
    '        <div class="vf-social">\n'
    '          <a href="https://wa.me/90{{ company_phone_intl }}" target="_blank" rel="noopener" aria-label="WhatsApp">WA</a>\n'
    '          <a href="https://instagram.com/viamood.store" target="_blank" rel="noopener" aria-label="Instagram">IG</a>\n'
    '          <a href="mailto:{{ settings.company_email }}" aria-label="E-posta">@</a>\n'
    '        </div>\n'
)
SOL_YENI = '        {%- comment -%} #995714: telefon/e-posta/sosyal tekrarı kaldırıldı (Bize Ulaşın\'da var); adres oraya taşındı {%- endcomment -%}\n'
IG_SATIRI = '<path d="M17.5 6.5h.01"/></svg>@viamood.store</a></li>\n'
SAG_ESKI = IG_SATIRI + '        </ul>\n'
SAG_YENI = IG_SATIRI + '          <li class="vf-adres">' + ADRES_IKON + '<span>{{ settings.company_address }}</span></li>\n        </ul>\n'
CSS_ESKI = '  /* Social */\n'
CSS_YENI = ('  /* #995714: «Bize Ulaşın» altındaki adres — bağlantı değil; boyut/satır yüksekliği komşu bağlantılarla\n'
            '     aynı (0.92rem · 1.5). Renk verilmedi: sol sütunda da beyaz hesaplanıyordu (ölçüldü), aynen kalsın. */\n'
            '  #shopify-section-{{ section.id }} .vf-adres {\n'
            '    font-size: 0.92rem;\n'
            '    line-height: 1.5;\n'
            '  }\n\n' + CSS_ESKI)
K = 'sections/via-footer.liquid'
CIFTLER = [(SOL_ESKI, SOL_YENI), (SAG_ESKI, SAG_YENI), (CSS_ESKI, CSS_YENI)]
def uygula(k, v):
    if k != K: raise SystemExit('bilinmeyen dosya ' + k)
    for e, y in CIFTLER:
        n = v.count(e)
        if n != 1: raise SystemExit(f'DUR {k}: çapa {n} kez (1 beklenirdi): {e[:60]!r}')
        v = v.replace(e, y)
    return v
if __name__ == '__main__':
    import os, hashlib, json
    B = os.path.dirname(os.path.abspath(__file__)); f = K.replace('/', '__')
    o = open(f'{B}/ONCESI/{f}', encoding='utf-8').read(); s = uygula(K, o)
    os.makedirs(f'{B}/SONRASI', exist_ok=True); open(f'{B}/SONRASI/{f}', 'w', encoding='utf-8').write(s)
    m = lambda x: hashlib.md5(x.encode()).hexdigest()
    json.dump({'once': m(o), 'sonra': m(s)}, open(f'{B}/md5.json', 'w')); print(m(o), '->', m(s))
