# Via Mood — Devir / Hand-off Dökümanı

> **Devralan:** Okan (GitHub: `oakin45@gmail.com`)
> **Hazırlık:** 2026-06-30
>
> ⚠️ **GÜVENLİK — ÖNCE OKU:** Bu doküman **hiçbir gerçek şifre / API key / secret İÇERMEZ.** Secret'lar bu dosyaya veya repoya **ASLA** yazılmaz (GitHub indeksler, klonlanır, cache'lenir — özel repo olsa bile sızar). Gerçek değerler Okan'a **ayrı + güvenli kanaldan** verilir → bkz. [7. Kimlik Bilgileri](#7-kimlik-bilgileri--secretlar).

---

## 1. Genel Bakış

Via Mood = **çok-tedarikçili (multi-vendor) e-ticaret** platformu. İki ana parça:

1. **Müşteriye dönük vitrin (storefront):** şu an **Shopify** — Horizon-tabanlı **"Clarity — Empire"** teması, `viamood.com.tr` (Cloudflare arkasında). Müşteri buradan alışveriş yapar.
2. **Operasyon / yönetim arka-ucu (`vendor-platform`):** kendi yazdığımız **Next.js (App Router) + Drizzle ORM + PostgreSQL (AWS RDS)** uygulaması, **AWS EC2**'de **PM2** ile çalışır. Tedarikçi yönetimi, sipariş/stok/komisyon, kargo & muhasebe entegrasyonları, admin paneli + (bayrak arkasında, henüz kapalı) **native vitrin**.

İki taraf **çift-yönlü senkronize** (Shopify→AWS webhook, AWS→Shopify push).

**Stratejik karar (önemli):** Shopify'dan tam çıkış (headless rebuild) **şu an YAPILMIYOR.** Karar: "Shopify'da kal + sertleştir." En değerli varlık = AWS vendor-platform + çalışan entegrasyonlar (KargoLab/Mikro/İyzico/PayTR) + binlerce sipariş. Native vitrin kodu (FAZ 2) bayrak arkasında hazır ama **production `STORE_BACKEND=shopify`** olarak DORMANT. Detay: [8. Bekleyen İşler](#8-bekleyen-işler--yol-haritası).

---

## 2. Sistem Mimarisi

```
  Müşteri ──→ viamood.com.tr (Cloudflare ──→ SHOPIFY "Clarity — Empire" teması)
                                   │
              webhook (orders/*, products/*, app/uninstalled)
                                   ▼
        API Gateway ──→ EC2 vendor-platform (Next.js + PM2)
                                   │
                       ┌───────────┼───────────────┬──────────────┐
                       ▼           ▼               ▼              ▼
                 RDS Postgres  KargoLab        Mikro        İyzico / PayTR
                 (sipariş/stok  (kargo/        (muhasebe)   (kart — hosted iframe)
                  /komisyon)     fulfillment)
```

- **Shopify → AWS:** `/api/shopify/webhooks` (X-Shopify-Topic ile dispatch). `ingestShopifyOrder` (order-ingest.ts) + `ingestShopifyProduct` (product-ingest.ts) upsert. HMAC doğrulaması `SHOPIFY_CLIENT_SECRET` ile.
- **AWS → Shopify:** `pushProductToShopify` (productSet mutation) — vendor ürününü Shopify'a yazar.
- **⚠️ ID FORMAT TUTARLILIĞI (kritik):** Shopify webhook + REST **numerik** id gönderir; GraphQL `gid://shopify/Product/...` döner. DB'de **numerik** saklanır (push gid→numerik normalize eder). Yoksa her push sonrası `products/create` webhook'u **ÇİFT kayıt** yaratır.
- **Webhook URL (HTTPS şart):** `https://mctpt0va3m.execute-api.eu-north-1.amazonaws.com/prod/api/shopify/webhooks` (API Gateway → EC2).

---

## 3. Repolar & Kod

| Ne | Nerede |
|---|---|
| **vendor-platform** (asıl kod) | `git@github.com:mehmetsah/viamood.git` — origin/`main` |
| Yapı | Next.js App Router · Drizzle · PostgreSQL · TypeScript · PM2 |
| **Shopify teması** | Repoda **DEĞİL** — Shopify'da canlı ("Clarity — Empire", theme id `192252608644`). Düzenleme = Admin Asset REST API (bkz. [5. Shopify](#5-shopify)) |
| `clarity-theme/` (yerel) | Base "Clarity" kopyası — canlı "Clarity — Empire" **DEĞİL**. Canlı dosyayı doğruluk kaynağı al, buradan körlemesine push etme. |

**Önemli dizinler (vendor-platform/src):**
- `db/schema/` — Drizzle şemaları (orders, products, customers, settings, inventory, carts…)
- `drizzle/` — SQL migration'lar (`0008_customers` … `0012_settings_backend_theme`). **Bazıları elle yazıldı** (db:generate journal'da yok) → `deploy.sh` bunları idempotent (`IF NOT EXISTS`/`ON_ERROR_STOP`) uygular.
- `lib/store/` — `StoreAdapter` arayüzü + `ShopifyStoreAdapter` + `nativeStoreAdapter` + `getStore()` (async, DB bayraklı)
- `lib/server/` — fulfillment-service (KargoLab), mikro-sync, commission-service
- `lib/{paytr,iyzico}/` — ödeme client'ları
- `lib/customers/`, `lib/cart/`, `lib/inventory/`, `lib/orders/`
- `app/admin/` — admin paneli (ürünler, müşteriler, ayarlar, tema editörü)
- `app/(storefront)/` — native vitrin (FAZ 2, bayrak arkası): `/magaza`, `/sepet`, `/odeme`, `/hesabim`

---

## 4. Sunucu & Deploy

- **EC2:** `ubuntu@13.62.159.252` (eu-north-1 / Stockholm, instance `i-034e18057c070c64e`), dizin `/var/www/viamood`, PM2 app `viamood-web`, Security Group `sg-0ac1f0986e7a695d3 (viamood-web)`.
- **DB:** AWS RDS Postgres — **VPC-private**, yerelden erişilemez (sadece EC2'den). Script'ler EC2'de: `set -a && source .env.production && set +a && ./node_modules/.bin/tsx <script>`.
- **🚀 DEPLOY = `git push origin main` (SSH GEREKMEZ):** Sunucudaki cron (`*/2 * * * * bash /var/www/viamood/scripts/auto-deploy.sh`) en geç 2 dk'da `origin/main` değişimini görür → migration'ları idempotent uygular → `npm run build` (**build fail'de restart YOK, eski sürüm kalır = güvenli**) → `pm2 restart viamood-web`.
- **Manuel SSH:** `ssh viamood` (alias). Sadece IP whitelist'liyse çalışır — IP değişince AWS Console → EC2 → Security Groups → `viamood-web` → inbound SSH/22/`<IP>/32` eklenir.
- **⚠️ Manuel `deploy.sh` ÇALIŞTIRMA — sadece `git push`.** Manuel + cron build AYNI ANDA çalışırsa 1.9GB instance **OOM** olur (sshd ölür, build yarıda kalır). Kurtarma: EC2 reboot (AWS Console).
- **Health:** `http://13.62.159.252/api/health` → 200 (`uptime:0` döner ama yanıltıcı; gerçek uptime PM2'de).
- **⚠️⚠️ KRİTİK AYRIM:** `13.62.159.252` = **native vendor-platform** ≠ `viamood.com.tr` = **canlı SHOPIFY**. Native'i doğrularken **EC2 IP'yi** curl'le. `viamood.com.tr/magaza` → **404 NORMALDİR** (native route, Shopify'da yok). Bunu karıştırmak yanlış "production down" paniğine yol açtı.

---

## 5. Shopify

- **Store:** `via-mood.myshopify.com` · **Domain:** `viamood.com.tr` (apex, Cloudflare). Apex SSL geçmişte doldu → panelden primary domain re-add edildi.
- **Tema:** **"Clarity — Empire"**, theme id **`192252608644`** (YAYINDA). (+yayınsız: "Clarity" 191852478596, "Tinker" 191862997124.)
- **Tema düzenleme yöntemi = Admin REST Asset API:**
  - GET/PUT `https://via-mood.myshopify.com/admin/api/2025-01/themes/192252608644/assets.json`
  - PUT body: `{"asset":{"key":"sections/...liquid","value":"<içerik>"}}`, `--data-binary` ile.
  - Auth: `SHOPIFY_ADMIN_ACCESS_TOKEN` (scope: `read_themes`+`write_themes`; ayrıca `read/write_products`, `read/write_orders` vb.).
- **Gotcha'lar:**
  - PUT'tan **hemen sonra GET stale** gösterir (read-after-write cache ~birkaç sn) → birkaç kez GET-back.
  - **Cloudflare edge cache + Shopify asset `immutable` header** → storefront'u **tarayıcıdan (cache-bust query / gizli pencere)** doğrula, `curl` değil. Hard-refresh bile bazen CSS'i bypasslamaz.
  - Bağlı **Shopify MCP = PEYAJ (peyaj.tr), Via Mood DEĞİL** — Via Mood için yukarıdaki Asset API + token kullan.
  - Canlı temaya yazmak riskli → her zaman önce GET ile yedekle, sonra PUT.

---

## 6. Entegrasyonlar

| Alan | Servis | Kod |
|---|---|---|
| **Kargo** | KargoLab (Aras vb. routing/fulfillment) | `lib/server/fulfillment-service.ts`, `lib/routing/engine.ts` |
| **Muhasebe** | Mikro | `lib/server/mikro-sync.ts` (`MIKRO_AUTO_PUSH`) |
| **Ödeme — kart** | İyzico (canlı) + PayTR (kod hazır, aktivasyon bekliyor) | `lib/iyzico/`, `lib/paytr/` |
| **Ödeme — diğer** | Havale/EFT + Kapıda ödeme (COD, nakit/kart %4) | checkout + `store_settings.payment` |
| **E-posta** | Resend | `lib/email/` (vendor/payout + native order mailleri) |

- **⚠️ PCI DEĞİŞMEZİ:** Kart bilgisi **HER ZAMAN** İyzico/PayTR **hosted iframe**'inde alınır; backend yalnız token alır. **Kendi sayfana ASLA kart input'u koyma** (SAQ-A → ağır denetim).
- **Hak ediş / settlement:** COD siparişleri tahsil olana dek `orders.financial_status = pending` kalır → komisyon ledger'a yazılmaz (`accrueCommissionForOrder` sadece `paid`'de yazar). `/payouts` header'ı bu COD pipeline'ını line-item + komisyon oranından **tahmin** eder. Yatış ≈ teslim + 1 gün (`PAYOUT_LAG_DAYS=1`).

---

## 7. Kimlik Bilgileri / Secret'lar

> 🔒 **DEĞERLER BU DOSYADA YOK — KASTEN.** Aşağıda her secret'ın **nerede durduğu** ve **nasıl güvenli aktarılacağı** var. Gerçek değerleri Okan'a **1Password / şifreli dosya / yüz yüze** ver. **E-posta/Slack/repo ile düz metin GÖNDERME.**

| Secret | Nerede durur | Okan'a nasıl geçer |
|---|---|---|
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | `vendor-platform/.env.local` (yerel) + EC2 `.env.production` | `.env` dosyasını güvenli paylaş **veya** Shopify Admin → Apps → custom app → yeni token üret |
| `SHOPIFY_CLIENT_SECRET` (webhook HMAC) | EC2 `.env.production` | aynı |
| `DATABASE_URL` (RDS) | EC2 `.env.production` | Okan'a EC2 erişimi ver (secret zaten orada) |
| `IYZICO_API_KEY` / `IYZICO_SECRET_KEY` | EC2 `.env` **veya** `/admin/settings` paneli | İyzico merchant paneli erişimi + admin paneli |
| `PAYTR_MERCHANT_ID` / `KEY` / `SALT` | `/admin/settings` paneli (tercih) **veya** EC2 `.env` | PayTR merchant paneli erişimi + admin paneli |
| `RESEND_API_KEY` | EC2 `.env` | Resend hesabı erişimi |
| EC2 SSH özel anahtarı (`ssh viamood`) | Yerel `~/.ssh/` | Güvenli paylaş **veya** Okan kendi public key'ini EC2'ye ekler |
| GitHub deploy key (EC2 → repo) | EC2'de | Okan repo erişimi alınca kendi anahtarı |
| AWS Console / IAM | — | IAM kullanıcı veya erişim anahtarı |
| Cloudflare | — | hesap/domain member ekleme |
| KargoLab / Mikro | — | ilgili panel kimlikleri |

---

## 8. Bekleyen İşler & Yol Haritası

**Yakın / kolay:**
- **PayTR aktivasyonu:** Backend artık `store_settings.payment`'ten okuyor (commit `2253ae3` — deploy edildi mi kontrol et). Adım: `/admin/settings` → PayTR 3 key gir + Kaydet → güvenli probe (`POST .../api/v1/payment/paytr/initialize -d '{}'` → **503**=key yok, **422**=key var/hazır) → tema `kart_gateway='paytr'` (via-checkout.liquid ~satır 349) → 5 TL test ürünüyle dene. **test_mode default=1 (sandbox).**
- **İyzico admin-config:** `/admin/settings`'ten İyzico key girişi (commit `282cd77`+`655dd38`; güvenlik guard'ı: admin'e İyzico key girilmedikçe canlı İyzico sandbox'a düşmez).
- Google Merchant Center feed ("Google & YouTube" kanalı + 234 ürüne AI Türkçe açıklama yazıldı; 34 görselsiz ürünün görseli eksik), GA4 property (G-XXXX → Shopify Admin → Preferences).

**Orta / FAZ 2 native vitrin (bayrak arkası, production'da KAPALI):**
- `STORE_BACKEND` bayrağı (default `shopify` — prod değişmez). `/admin/settings`'ten "Shopify ↔ Kendi altyapımız" anında değişir (redeploy yok).
- **Dilim 1-3 KOD-TAM** (native sipariş havale/COD/kart + paid→komisyon + kargo/teslim/onay e-postaları), flag arkası, **yalnız yerel doğrulandı**. Canlıya almadan önce **ayrı staging'de İyzico/PayTR SANDBOX callback roundtrip** test edilmeli (prod'da flag=native = gerçek siparişler RDS'e gider, RİSKLİ).
- **Dilim 4** (native sepet/checkout) backend hazır (`carts` tablosu + `/api/v1/cart`), **tema wire EDİLMEDİ**.
- **Dilim 5-6** (headless katalog/PDP + stok SoT) = FAZ 2'nin asıl 12-16 aylık gövdesi; **Shopify ToS runbook kararı** + SEO/canary şart. Tek seansta bitmez.

**"Shopify'dan çık" tetikleyicileri** (en az biri olmadan headless'a para gömme): (1) Shopify ToS aksiyonu/askı; (2) Plus zorlaması (~$2000+/ay); (3) ikinci gerçek mağaza; (4) dönüşüm kaybı KANITI (ölç, his değil).

---

## 9. Önemli Notlar & Gotcha'lar

- **ID format:** Shopify webhook numerik / GraphQL gid → DB numerik sakla (çift kayıt önler).
- **Tema/CSS değişikliğini DOĞRULA:** cache-bust query + tarayıcıdan (gizli pencere); `curl` eski edge cache gösterir.
- **Galeri dersi (2026-06-30):** Ürün galerisinde **CSS yama yığma — native'i koru.** Üst üste `max-height`/konteyner kapakları native kare galeriyi bozup görseli off-center bıraktı; tüm yamalar kaldırılıp native + tek temiz `max-width:540 + display:block + object-fit:contain` ile düzeldi. Müdahale yüzeyini minimumda tut.
- **Migration:** `deploy.sh` 0008-0012'yi idempotent uygular. `db:generate` BigInt bug'ı düzeltildi. **Sıra önemliydi** (0009 fulfillment'a bağımlı) — artık otomatik.
- **EC2 RAM dar (1.9GB):** çift build = OOM. Sadece `git push`, manuel build yok.
- **Locale/çeviri:** geçmişte "site İngilizce" sorunu = Translate&Adapt'ın tr slotuna İngilizce yazması; base Türkçe'yi tr'ye `translationsRegister` ile çözüldü (silmek cache temizlemez).

---

## 10. Devir Adımları — Erişim Aktarımı (Mehmet yapacak)

> ⚠️ **Bu adımları Claude YAPAMAZ** (erişim/paylaşım ayarı değiştirme = güvenlik kuralı). Mehmet yapar:

1. **GitHub:** repo → Settings → Collaborators → `oakin45@gmail.com` ekle (Write veya Admin).
2. **AWS:** IAM'den Okan'a kullanıcı aç **veya** EC2 SSH erişimi (public key'ini `authorized_keys`'e + IP'sini SG'ye `/32`) + gerekiyorsa RDS erişimi.
3. **Shopify:** Settings → Users and permissions → Okan'ı staff olarak ekle (gerekli izinlerle).
4. **Cloudflare:** hesap → Members → Okan'ı ekle (domain yönetimi için).
5. **Ödeme panelleri:** İyzico + PayTR merchant hesaplarına Okan'ı ekle (veya kimlikleri güvenli paylaş).
6. **KargoLab + Mikro:** ilgili panel erişimleri.
7. **Secret'lar:** `.env.local` / `.env.production` + SSH key'i **güvenli kanaldan** (1Password / şifreli) ver. **Asla repo/e-posta ile düz metin.**
8. Bu `DEVIR.md` repoya commit'lenince Okan, repo erişimini aldığı anda görür.

---

## 11. Hızlı Başlangıç (Okan için)

```bash
# 1. Repoyu klonla
git clone git@github.com:mehmetsah/viamood.git && cd viamood

# 2. .env.local oluştur (Mehmet'ten güvenli aldığın secret'larla)
cp .env.example .env.local   # (yoksa mevcut .env.local'i güvenli al)

# 3. Bağımlılıklar + yerel DB (yerel Postgres: viamood_vendor)
npm install
# Drizzle migration'ları için drizzle/ klasörü + deploy.sh'a bak

# 4. Geliştirme
npm run dev        # http://localhost:3000  (admin: /admin, seed admin şifre: Admin1234)

# 5. Deploy (PRODUCTION) — SADECE:
git push origin main     # sunucu cron'u 2 dk içinde otomatik deploy eder
```

- Admin paneli: `/admin` (ürün, müşteri, ayar, tema editörü, ödeme key girişi).
- Native vitrin (kapalı): `/magaza`, `/sepet`, `/odeme`, `/hesabim` — `STORE_BACKEND=native` olmadan sipariş tamamlanmaz.
- Canlı Shopify temasını düzenlemek: [5. Shopify](#5-shopify) Asset API.

---

**Sorular için:** bu doküman + repo `git log` + `drizzle/` migration geçmişi en güncel kaynaktır. Üretim verisi RDS'te (EC2'den erişilir).
