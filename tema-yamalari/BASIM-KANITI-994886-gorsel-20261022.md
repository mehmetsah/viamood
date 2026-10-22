# BASIM KANITI · #994886 · m6 görsel optimizasyonu · ŞAH · 22 Eki 2026 14:12

Canlı tema 195348856964. Yama sunucuda canlı dosyadan türetildi (GET → eşleşme sayısı kontrollü replace → PUT → GET-back md5).
Önce önizleme teması 196763975812'de (themeDuplicate) test edildi; canlıya basılan md5'ler önizlemede test edilenlerle birebir aynı.

| dosya | ÖNCE md5 | SONRA md5 (GET-back) |
|---|---|---|
| snippets/product-media.liquid | a8a5c80539d618abaa60bd4ada44141a | 29aed6276f923bb996bd9fc38fa034ee |
| snippets/product-media-gallery-content.liquid | a033c7a5c7d49e63ee9536d2513636eb | 394fd76187cf9bb09ec6f94555796bb9 |
| snippets/card-gallery.liquid | 6b4a604b309605f34c654be78544e8da | ee7f4e4fe64bbba9bf91c938558aee72 |
| sections/via-benzer-kategori.liquid | 4cbfb4fadc7ae0eb0363a6c22ba8999f | df11f117f0a3622806948437a7236406 |
| sections/via-koleksiyon-v2.liquid | b32437c8af0be7f1dd21431dcdc5ffa4 | 09c5a3fe105abef76cce2d2873f17ea3 |
| sections/via-mood-home-v2.liquid | a321550e5681473d6419b29486a49c0a | 124ef5266031902fef777bbc0a818370 |

Geri alma: `994886-gorsel/<dosya>.ONCESI` içeriğini `value` ile PUT et (attachment sessizce yok sayılır), GET-back md5 = ÖNCE.
Yama tanımı + uygulayıcı: `994886-gorsel/yama-spec.py`, `994886-gorsel/uygula.py`. Çivi: `tests/gorsel-optimizasyon-tema.test.ts`.
