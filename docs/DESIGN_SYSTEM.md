# kargolab · Tasarım Sistemi (v1 — öneri)

> Tek kaynak. Buradaki token ve kurallar dışına çıkılmaz. Yeni bir sayfa
> yaparken "hangi padding / hangi renk / hangi font" diye düşünmüyoruz —
> aşağıdaki ölçeklerden seçiyoruz. Amaç: **hızlı, tutarlı, güvenilir, iddialı.**

İlgili dosyalar: [`globals.css`](../src/app/globals.css) (token kaynağı),
[`components/ui/`](../src/components/ui) (bileşenler), layout'lar
[`(vendor)/layout.tsx`](../src/app/(vendor)/layout.tsx) ·
[`admin/layout.tsx`](../src/app/admin/layout.tsx).

---

## 0. Prensipler

1. **4px grid** — tüm boşluklar 4'ün katı. Rastgele `p-5`, `mt-7` yok.
2. **2 font ağırlığı UI'da yeter** — 500 (gövde) ve 700 (başlık/sayı). 600 ara ton sadece buton/etiket.
3. **Sayılar her zaman tabular + mono** — para, adet, takip no hizalı durur.
4. **Renk anlam taşır** — turuncu = aksiyon/marka, durum renkleri sabit (bkz. §5.6).
5. **Mobil = uygulama** — bottom-nav, 44px dokunma hedefi, swipe, bottom-sheet, sticky header.
6. **Önce token, sonra istisna** — bir değer 2+ yerde tekrarlıyorsa token olur.

---

## 1. Marka & ton

- **İsim:** kargolab (her zaman küçük harf), turuncu nokta marka işareti.
- **Karakter:** net, hızlı, operasyonel. Süs yok; veri ve aksiyon önde.
- **Wordmark:** `● kargolab` — nokta `--accent`, üstünde yumuşak halka.

---

## 2. Renk

### 2.1 Çekirdek (light)
| Token | Hex | Kullanım |
|---|---|---|
| `--ink` | `#141A18` | Sidebar (admin), en koyu metin, koyu yüzey |
| `--bg` | `#F4F3EE` | Sayfa zemini (sıcak kırık beyaz) |
| `--surface` | `#FBFAF6` | Topbar, tablo başlığı, ikincil yüzey |
| `--paper` | `#FFFFFF` | Kart / panel zemini |
| `--line` | `rgba(20,26,24,.09)` | Varsayılan kenarlık |
| `--line-2` | `rgba(20,26,24,.15)` | Hover / vurgulu kenarlık |
| `--tx` | `#171D1B` | Birincil metin |
| `--tx-2` | `#5C635F` | İkincil metin |
| `--tx-3` | `#8A908C` | İpucu / placeholder |

### 2.2 Marka & aksiyon
| Token | Hex | |
|---|---|---|
| `--accent` | `#E1691F` | **Birincil aksiyon, marka turuncusu** (mevcut `brand-orange`) |
| `--accent-2` | `#C45614` | Hover / basılı |
| `--accent-soft` | `#FBEBDD` | Turuncu zeminli rozet/banner |
| `--clay` | `#B66C55` | İkincil sıcak vurgu (mevcut `brand-clay`) |

### 2.3 Semantik
| Anlam | Token | Hex | Soft |
|---|---|---|---|
| Başarı / teslim | `--ok` | `#0F8A66` | `--ok-soft #E2F4ED` |
| Uyarı / bekliyor | `--warn` | `#B5810B` | `--warn-soft #FBF0D8` |
| Bilgi / yolda | `--info` | `#2566C4` | `--info-soft #E5EEFA` |
| Hata / sorun | `--danger` | `#C8453B` | `--danger-soft #FBE7E5` |

### 2.4 Dark mode (zorunlu)
Tüm token'ların `.dark` karşılığı var (prototipe bakınız). Kural: koyu modda
zemin `#0C100F`, yüzey `#171F1C`, turuncu bir tık parlar (`#F07A2E`). Her renk
iki modda da okunur olmalı — "near-black zeminde okunur mu?" testi.

> Önceki `brand-cream / brand-ink / brand-orange / brand-clay` korunuyor;
> sistem bunların **üstüne** semantik + nötr ölçek ekliyor. Marka DNA'sı aynı.

---

## 3. Tipografi

- **Font:** `Plus Jakarta Sans` (UI + başlık), **`JetBrains Mono`** (sayı, takip no, para).
  - Mevcut `--font-sans` system stack korunabilir; öneri Jakarta'ya geçiş.
- **Sayılar:** `.num { font-family: var(--mono); font-feature-settings:'tnum'; letter-spacing:-.02em }`

| Rol | px / weight | Not |
|---|---|---|
| Display (KPI değeri) | 30 / 600 mono | `letter-spacing:-.04em` |
| H1 (sayfa başlığı) | 25 / 800 | `-.03em` |
| H2 | 19 / 700 | |
| H3 (kart başlığı) | 15 / 700 | |
| Gövde | 13.5–14 / 500 | `line-height:1.5` |
| Küçük / meta | 12–12.5 / 500 | `--tx-2` |
| Etiket başlığı (tablo th) | 11 / 700 | UPPERCASE, `letter-spacing:.05em` |
| Mikro | 11 / 500 | min font 11px |

Cümle düzeni: **sentence case**. ALL CAPS sadece tablo başlığı + grup etiketi.

---

## 4. Ölçek: boşluk, köşe, gölge

### 4.1 Spacing (4px tabanı)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40`
- Bileşen içi gap: 8/12/16
- Kart padding: `17px 18px` (≈ 16/20)
- Sayfa padding: 24–26
- Bölümler arası dikey ritim: 14 (kartlar arası) / 18–22 (başlık altı)

### 4.2 Köşe yarıçapı
| Token | px | Kullanım |
|---|---|---|
| `--r-sm` | 9 | küçük buton, ikon kutusu |
| `--r-md` | 13 | buton, input, filtre |
| `--r-lg` | 18 | kart, panel, tablo wrap |
| `--r-xl` | 24 | dış çerçeve / büyük yüzey |
| `--pill` | 999 | rozet, durum pill, segment, avatar |
> Tek taraflı border (border-left vurgusu) varsa radius 0.

### 4.3 Gölge (3 seviye)
- `--sh-1` kartlar (çok hafif), `--sh-2` popover/drawer, `--sh-3` modal/cihaz çerçevesi.
- Dekoratif gölge/parlama yok; sadece bu 3 token.

### 4.4 Layout
- Sidebar genişlik **248px** (collapse → 72px ikon modu).
- İçerik max genişlik liste/detayda yok (full); dashboard 1320px ortalı.
- Topbar yükseklik 66px, mobil app-bar sticky.

---

## 5. Bileşenler

### 5.1 Buton (`components/ui/Button.tsx` güncellenecek)
| Variant | Zemin | Metin | Not |
|---|---|---|---|
| `primary` | `--accent` | #fff | gölge `0 6px 16px rgba(225,105,31,.28)` |
| `ghost` | `--paper` | `--tx` | `1px --line-2` |
| `subtle` | `--bg` | `--tx-2` | kenarlıksız |
| `danger` | `--danger` | #fff | |

Boyutlar: `sm` h34/px13, `md` h42/px18, `lg` h48/px22. Radius `--r-md`
(mevcut tam yuvarlak `rounded-full` yerine — sadece pill/segment yuvarlak).
İkon 17px, gap 8. Loading: dönen spinner, içerik gizlenmez.

### 5.2 Input / filtre / arama
- Yükseklik 40, radius `--r-md` (arama çubuğu `--pill`), `1px --line`.
- Focus: `0 0 0 3px rgba(225,105,31,.18)` halka, kenarlık `--accent`.
- Arama çubuğunda `⌘K` kbd ipucu.

### 5.3 Rozet / chip
- Pill, 11.5px/700, soft zemin + koyu metin (aynı renk ailesinin 800/900).
- Delta chip: `up` (ok-soft/ok), `dn` (danger-soft/danger), mono.

### 5.4 Kart & KPI
- Kart: `--paper`, `1px --line`, `--r-lg`, `--sh-1`, padding `17/18`.
- Başlık satırı: H3 solda, aksiyon linki sağda (`--accent-2`, 12.5px).
- KPI: ikon kutusu (30px, soft renk) + label → mono değer (30px) → alt satır delta.

### 5.5 Tablo (liste ekranlarının omurgası)
- Wrap: kart gibi (`--r-lg`, border, `--sh-1`, `overflow:hidden`).
- `thead th`: sticky, `--surface`, 11px UPPERCASE `--tx-3`.
- `td`: padding `13/14`, alt çizgi `--line`, son satır çizgisiz.
- Satır hover `--surface`, seçili satır `--accent-soft`.
- Sayısal kolon (tutar, tarih, desi) → sağ hizalı + `.num`.
- Checkbox seçim + toplu aksiyon barı; satır hover'da `⋯` aksiyon.
- **Mobilde tablo → karta dönüşür** (bkz. §6).
- Yoğunluk toggle: rahat (13/14 padding) ↔ sıkı (8/10).

### 5.6 Durum pill — SABİT eşleme
Mevcut `orderLineItems.status` ile birebir:
| status | Etiket | Sınıf | Renk |
|---|---|---|---|
| `pending` | Routing bekliyor | `.st.route` | nötr `--bg`/`--tx-2` |
| `awaiting_pickup` | Etiket bekliyor | `.st.wait` | warn |
| `shipped` | Kargolandı | `.st.ship` | info |
| `delivered` | Teslim edildi | `.st.deliv` | ok |
| `cancelled` | İptal | `.st.prob` | danger |
| `refunded` | İade | `.st` (clay/warn) | clay |
| _adres/teslim sorunu_ | Adres sorunu | `.st.prob` | danger |
Pill = renkli nokta + metin. Bu eşleme tüm uygulamada aynı.

### 5.7 Detay drawer (gönderi/sipariş)
- Sağda sticky panel (348px) veya mobilde bottom-sheet.
- Üst: başlık (mono) + durum pill → mini harita → **takip timeline** → künye satırları → aksiyon butonları.
- Timeline: nokta + dikey çizgi; `done` (ok dolu), `now` (accent + halka), gelecek (boş).

### 5.8 Boş & yükleniyor durumları
- Boş: ikon + tek cümle + birincil aksiyon. "Henüz X yok" + buton.
- Yükleniyor: skeleton (kart/sat şekilli), spinner sadece buton içi.

---

## 6. Mobil — "app gibi"

- **Bottom nav** (sticky, blur): 4 sekme + ortada turuncu **FAB** (Yeni gönderi).
  Sekmeler: Özet · Gönderiler · [FAB] · Siparişler · Menü.
- **App-bar:** wordmark + arama + bildirim; sayfa içi başlık altında.
- **Dokunma hedefi min 44×44.**
- **Segment chip scroller** (yatay kaydırmalı durum filtreleri).
- **Swipe aksiyon:** satır sola kaydırılınca bağlama göre aksiyon
  (Etiket bas / Takip / Çöz) — renk duruma göre.
- **Bottom-sheet:** detay & filtre alttan açılır panel.
- **PWA:** installable, offline kabuk, pull-to-refresh hissi.
- Tablo verisi mobilde **kart listesi** olur (gönderi no + durum + tutar + müşteri·şehir).

---

## 7. Harita (gönderi takip)

- **Stil:** tek renk koyu taban (`--ink`), grid çizgileri `rgba(255,255,255,.08)`.
- **Rota:** `--accent`, kesik çizgi (`stroke-dasharray:2 7`), yuvarlak uç.
- **Marker:** başlangıç beyaz halka + turuncu çekirdek; varış dolu turuncu pin.
- **Etiketler:** mono, küçük, düşük opak beyaz.
- Container `--r-lg`, drawer/sheet içinde 158–200px.
- Gerçek harita: Mapbox/MapLibre **monokrom** stil + turuncu rota katmanı
  (marka renkleri zeminde boğulmasın). Dark varyant zorunlu.

---

## 8. Hareket (motion)

- Süreler: 120ms (hover), 180ms (panel/drawer), 240ms (sheet/sayfa geçişi).
- Easing: `cubic-bezier(.2,.7,.2,1)`.
- Aşırı animasyon yok; sadece state geçişi ve giriş.

---

## 9. Navigasyon mimarisi

**Desktop sidebar grupları** (admin koyu / vendor açık varyant):
- **Operasyon:** Özet · Gönderiler · Siparişler · AI Kargo
- **Katalog:** Ürünler · Set Ürünler · Stok
- **Finans:** Ödemeler · Kârlılık · (admin) Fiyat Hesap
- **Sistem (admin):** Tedarikçiler · Routing · Kargo Tarifeleri · Shopify · Mikro · Audit

Aktif öğe: turuncu dolgu + gölge. Sayaç rozeti (mono) sağda.
Emoji kaldırılıyor → **Tabler outline** ikonlar.

---

## 10. Erişilebilirlik

- Kontrast AA (metin 4.5:1, büyük 3:1). Turuncu üstü beyaz ✓.
- Klavye: focus halkası her interaktif öğede.
- İkon-only butona `aria-label`; dekoratif ikona `aria-hidden`.
- Durum sadece renkle anlatılmaz — pill'de metin + nokta birlikte.

---

## 11. Uygulama notu (Tailwind 4)

Token'lar [`globals.css`](../src/app/globals.css) içindeki `@theme` bloğuna
eklenir; bileşenler `var(--token)` veya Tailwind util (`bg-[var(--accent)]`)
kullanır. Mevcut `brand-*` token'ları korunur, üzerine `--surface/--line/--tx*/
--ok/--warn/--info/--danger/--r-*/--sh-*` eklenir. Dark mode `.dark` sınıfı +
`prefers-color-scheme` ile.

Önce 3 ekranda otururuz (menü/layout, dashboard, shipments), kritiğe göre
token'lar kilitlenir, sonra diğer şablonlara (liste/detay/form) uyarlanır.
