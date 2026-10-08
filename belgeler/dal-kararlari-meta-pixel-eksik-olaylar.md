# `kod/meta-pixel-eksik-olaylar` — KAPATILDI, main'e ALINMAYACAK

**Karar:** Elif · 8 Eki 2026 · kart #992993 · ölçümle verildi, tahminle değil.
**Neden bu dosya var:** dal iki kez "revert riski var" denip arşive alındı ve her turda
yeniden incelendi. Bu kayıt üçüncü kez açılmasını önler (md.24 — aynı iş ikinci kez açılmaz).

## Ölçüm

**Dalın içeriği: TEK commit.**
`0045568` · 25 Eyl · *"revert: ezilen Halkode form dosyalarini geri getir (736f2ad kazasi)"*
→ `tema-yamalari/via-checkout.liquid.halkode-form-b` (**+1716**) ve
  `tests/halkode-form-b.test.ts` (**+147**). Başka hiçbir şey yok.

**1 · Dalın ADI içeriğiyle uyuşmuyor — pixel işi burada DEĞİL.**
`form-b` içinde pixel izi aranan tüm anahtarlar **0**:
`fbq 0 · ViewContent 0 · AddToCart 0 · InitiateCheckout 0 · Purchase 0 · pixel 0 · connect.facebook 0`
⇒ "Taşınacak pixel event mantığı" diye bir şey YOK.

**2 · Asıl pixel işi ZATEN main'de: `736f2ad`.**
*"fix(pixel): fbq async yuklendigi icin beklenir, olay kapsami daraltildi"* — `is-ancestor` → **main'DE**.
Ne düzeltti (commit diff'inden birebir):
· **Kök kusur:** `fbq` **ASYNC** yükleniyor (Shopify Web Pixel sayfa yüklenirken indiriyor); snippet ondan
  önce koşarsa `window.fbq` tanımsız oluyor ve **olay SESSİZCE kaçıyordu**.
  Eski kod: `if (!window.fbq) return;` → olay kayboluyordu.
  Yeni kod: `vmFbqHazirOlunca(function (fbq) { … })` → fbq hazır olana kadar bekliyor.
· **Kapsam daraltması:** `InitiateCheckout` gereksiz tetiklenmesin diye daraltıldı
  (*"Meta'da InitiateCheckout şişerse dönüşüm oranı düşük görünür"*).
· Dokunduğu dosyalar: `via-meta-pixel-tamamlayici.liquid`, `tests/meta-pixel-cift-sayim.test.ts`.
**Bugün main'de tanımlı olaylar:** `ViewContent 11 · AddToCart 9 · InitiateCheckout 14 · Purchase 10 · PageView 13`.

**3 · "Kaza" zaten ONARILDI — ama form-hp ile değil.**
`736f2ad` yan hasar olarak `form-b`'yi sildi; `0045568` onu geri koymak için açıldı.
⚠ **Kartın öncülü yanlıştı:** *"güncel ad form-hp"* denmişti. Ölçüm:

| Dosya | `hp-tile` | `vco-hk-tk` | satır |
|---|---|---|---|
| `…halkode-form-hp` | **31** | 0 | 2013 |
| `…CANLI-YUNUS-MAKET-SONRASI` | 0 | **29** | 1779 |
| `…halkode-form-b` (dalda) | 0 | **22** | 1716 |
| **CANLI SAYFA** (`/pages/odeme`) | **0** | **29** | — |

⇒ **Canlı olan `CANLI-YUNUS-MAKET-SONRASI`** (vco-hk ailesi). `form-hp` ayrı bir tasarım ve
**uygulanmamış**. `form-b` ise canlı ailenin **eski** üyesi; yerini `CANLI-YUNUS-MAKET-SONRASI` aldı
(main'de). Yani yan hasar **daha iyi bir dosyayla** kapandı.

**4 · form-b'nin özgün 18 satırı — geri getirilmemeli.**
`form-b`'de olup CANLI'da olmayan anlamlı satır **18**; CANLI'da olup form-b'de olmayan **76**.
O 18 satırın özü **eski DİKEY taksit düzeni**:
`.vco-hk .vco-hk-tk__s { grid-template-columns:20px 1fr auto; }`
Bu tam olarak Yunus'un **29 Eyl'de kaldırttığı** düzen (yerine yan yana kutucuk geldi).
⇒ Merge edilirse **geri alınmış bir tasarım geri gelir** ve ölü bir test dosyası (`halkode-form-b.test.ts`)
depoya döner.

## Hüküm
**MERGE EDİLMEYECEK.** Dal ne pixel işi taşıyor (0 eşleşme), ne de kurtarılacak bir dosya
(yerine geçen daha yeni dosya main'de). Merge etmek yalnız ölü kod + eski tasarım geri getirirdi.
Dal **silinmedi**, uzakta duruyor; bu kayıt gerekçesidir.
