# Architecture — Via Mood Vendor Platform

Bu doküman teknik karar gerekçelerini ve sistem tasarımını içerir.

---

## 1. Stack Seçimi

| Katman | Teknoloji | Neden |
|---|---|---|
| **Frontend** | Next.js 15 (App Router) + React 19 | SSR + RSC, Vercel native, ekosistem |
| **UI** | Tailwind CSS + shadcn/ui | Hızlı, özelleştirilebilir, tutarlı |
| **TypeScript** | strict mode | Tip güvenliği zorunlu |
| **DB** | PostgreSQL 16 | İlişkisel garanti (para/sipariş için şart), JSONB, partitioning, FTS |
| **ORM** | Drizzle ORM | Performant, edge-runtime, raw SQL friendly, type-safe migrations |
| **Auth** | Auth.js (NextAuth v5) | Email/pass + magic link + Google + Apple tek setup |
| **Validation** | Zod | DB ↔ API ↔ UI tek tip dili |
| **Queue** | BullMQ + Redis | Webhook, payout, sync için reliable async |
| **Cache** | Redis | Session, sayaç, hot path |
| **Storage** | Supabase Storage / S3-compatible | Vendor evrakları, ürün görselleri |
| **Email** | Resend | Transactional |
| **Logs/APM** | Sentry + Vercel Analytics (start) → Datadog (scale) | Hata + perf |
| **Hosting** | Vercel (web) + Railway/Fly.io (worker) → K8s (scale) | İlk başta managed |

---

## 2. Veri Tabanı Tasarım Prensipleri

### Multi-tenant model
- Her vendor verisi `vendor_id` ile partition'lanır
- **Row-Level Security (RLS)**: Postgres-level isolation — vendor rolü kendi verisi dışını DB'den göremez (uygulama hatası → veri sızıntısı garantisi yok)

### ID stratejisi
- **UUID v7** primary key — zaman-sıralı (b-tree friendly), distributed-safe, shard'lanabilir
- Auto-increment integer KULLANILMAZ (multi-region, sharding'de problem)

### Para
- **Integer cents** — TL × 100. Float yok (yuvarlama hatası birikir)
- Currency hep `TRY`, ileride multi-currency için `currency` kolonu ekli

### Append-only event log
- `order_events`, `audit_log` immutable
- Güncel state event'lerden derive edilir veya cache'lenir
- Audit/compliance için zorunlu (KVKK)

### Idempotency
- Tüm webhook + payment + fulfillment endpoint'lerinde `idempotency_key` zorunlu
- Duplicate request = no-op + cached response

### Soft delete
- `deleted_at` kolonu, hard delete yok
- KVKK silme talebinde 30 gün retention sonra hard delete + audit kayıt

### Denormalization (read perf)
- Vendor counters (`product_count`, `total_revenue_cents`) trigger ile güncellenir
- `vendor_slug`, `vendor_name` ürün satırına kopyalanır (JOIN'siz okuma)

### Partitioning (scale-ready)
- `orders`, `order_events`, `audit_log`, `commission_ledger` aylık partition (Tier 1+ aktive)
- Eski partition'lar archived storage'a (S3 cold storage)

### Optimistic concurrency
- `inventory_levels` tablosunda `version` kolonu — concurrent update conflict detect

---

## 3. Şema Modülleri

`src/db/schema/` altında ayrı dosyalar:

```
src/db/schema/
├── auth.ts              # users, sessions, accounts (Auth.js standart)
├── vendors.ts           # vendors, vendor_kyc_documents, memberships
├── products.ts          # products, product_variants
├── inventory.ts         # inventory_levels
├── orders.ts            # orders, order_line_items
├── events.ts            # order_events (append-only)
├── routing.ts           # routing_rules, routing_decisions
├── fulfillments.ts      # fulfillments, tracking_events
├── ledger.ts            # commission_ledger, payouts
├── audit.ts             # audit_log
└── index.ts             # re-export
```

---

## 4. Shopify Senkronizasyon

### Yön
| İşlem | Yön | Tetikleyici |
|---|---|---|
| Ürün oluştur/güncelle | DB → Shopify | Vendor dashboard'da kaydetme |
| Stok güncelle | DB → Shopify | Inventory mutation veya periyodik |
| Sipariş geldi | Shopify → DB | Webhook `orders/create` |
| Ödeme onaylandı | Shopify → DB | Webhook `orders/paid` |
| Refund | Shopify → DB | Webhook `refunds/create` |

### Webhook İşlem Akışı
1. Shopify webhook → Next.js API route
2. HMAC verification (timing-safe compare)
3. Idempotency key (Shopify event ID) → Redis SET, varsa skip
4. Event'i BullMQ kuyruğuna at, 200 OK dön (Shopify timeout etmesin)
5. Worker async işler: DB transaction, routing kararı, KargoLab etiket vs.
6. Hata olursa retry (exponential backoff), 3 deneme sonra dead letter

### Rate Limiting
- Shopify Admin API: 50 req/sn (REST), GraphQL cost-based
- Bulk operations için Bulk Operation API (background job)
- BullMQ rate limiter ile kuyruğu throttle

---

## 5. Sipariş Yönlendirme Engine

### Akış
```
1. orders/create webhook geldi
2. line item'lar vendor'lara grupla (vendor_id ile)
3. Tek vendor mu? → o vendor'a doğrudan assign, return
4. Çok vendor → routing_rules tablosundan priority sırasıyla evaluate et
5. İlk eşleşen kuralın action'ı (split | consolidate_self | consolidate_carrier) seç
6. routing_decisions tablosuna yaz (idempotent)
7. Aksiyona göre:
   - SPLIT: her vendor için Shopify FulfillmentOrders API ile assign
   - CONSOLIDATE_SELF: tüm line item'ları bizim location'a route, vendor'lara "bizim depoya gönder" notification
   - CONSOLIDATE_CARRIER: KargoLab multi-pickup API çağır
8. Customer email'i tek confirmation: "Siparişin alındı, kargoya verildiğinde tracking gelecek"
```

### Kural Editörü (Admin UI)
- Drag-drop priority sıralama
- Condition builder: lokasyon, tutar, ağırlık, vendor sayısı
- Test mode: simüle sipariş gir, hangi kural matched gör

---

## 6. Auth & Authorization

### Auth.js (NextAuth v5) konfigürasyonu
- **Providers**: Credentials (email/pass), Email (magic link via Resend), Google, Apple
- **Adapter**: Drizzle Auth.js adapter
- **Session**: Database (JWT yerine, revoke imkanı)

### Roles
- `customer` — Shopify customer (storefront)
- `vendor` — kendi vendor'ına bağlı (membership tablosu)
- `vendor_admin` — vendor sahibi
- `admin` — bizim ekip
- `super_admin` — ekstra ayrıcalık

### RBAC
- Server actions ve API routes'ta middleware
- DB seviyesinde RLS (vendor rolü kendi `vendor_id`'sini görür)

---

## 7. Ödeme Entegrasyonu

### Iyzico Pazaryeri (öneri)
- Submerchant API ile her vendor için subaccount yarat
- Checkout'ta `subMerchantKey` ile split yapısı
- Webhook ile success/fail handling
- KYC: Iyzico paneline vergi levhası + IBAN yükleme (vendor self-serve)

### Cari Mode
- Müşteri ödemesi standart Iyzico checkout (split yok)
- DB'de `commission_ledger` accrued status
- Periyodik job (cron / BullMQ scheduled) → her vendor için bekleyen tutar hesapla
- Admin onay → `payouts` batch yarat
- Banka aktarımı: CSV export (manuel) veya Iyzico Transfer API (otomatik)

### Toggle
Vendor row'da `payment_mode` enum. Cron checkout'ta vendor mode'una göre rotaya yönlendirir.

---

## 8. KargoLab Entegrasyonu

- API key vendor'lar için bir tane mi, vendor başına mı? (audit edilecek)
- Etiket basma: Order fulfillment'tan tetik
- Multi-pickup: KargoLab destekliyor mu? — Phase 0'da netleşecek

---

## 9. Caching Stratejisi

| Veri | Yer | TTL |
|---|---|---|
| Session | Postgres | DB native |
| Vendor dashboard counters | Redis | 60s |
| Storefront product list (Shopify) | Vercel Edge | 5min |
| Shopify Admin API responses | Redis | 10s (bazıları) |
| Static assets | Vercel CDN | sürekli |

Cache invalidation: write-through (vendor ürün güncellediğinde ilgili cache key'leri purge).

---

## 10. Observability

### Tier 0
- Sentry (error tracking)
- Vercel Analytics (web vitals)
- Postgres slow query log
- BullMQ dashboard (job queue görünüm)

### Tier 1+
- Datadog APM (full tracing)
- Custom dashboards: vendor login rate, order processing time, payout SLA
- Alerts: routing engine fail, payment fail, DB connection pool exhaustion

---

## 11. Compliance (KVKK)

- **Veri merkezi**: Frankfurt (eu-central-1) — KVKK uyumlu (EEA)
- **Audit log**: tüm admin işlemleri
- **Data retention**: kişisel veri max 5 yıl, sonrası anonymize/sil
- **Right to erasure**: soft delete → 30 gün → hard delete + audit
- **Consent**: vendor onboarding'de açık rıza
- **Encryption**: at-rest (RDS native) + in-transit (TLS)

---

## 12. Test Stratejisi

- **Unit**: Vitest — utility, schema validation
- **Integration**: testcontainers (Postgres), real DB
- **E2E**: Playwright — vendor flow, admin flow
- **Load**: k6 — routing engine throughput hedef 1000 sipariş/dakika

---

## 13. Deployment

### CI/CD
- GitHub Actions: lint + type-check + test on PR
- Vercel preview deployment otomatik
- Main merge → production deploy

### DB Migrations
- `drizzle-kit generate` PR'da
- Migration'lar reviewed
- Production'da `drizzle-kit migrate` deploy hook'unda

### Secret Management
- Vercel/Railway env vars
- Production secrets git'e commit edilmez
- `.env.example` template olarak repo'da

---

## 14. Açık Mimari Kararları (Faz 0'da netleşecek)

1. Iyzico vs PayTR final seçim
2. Email transactional: Resend mı, başka mı?
3. Search: pg_trgm yeter mi, Meilisearch baştan mı?
4. Image optimization: Shopify CDN mi, Cloudflare Images mi?
5. KargoLab multi-pickup destek
6. e-Fatura sağlayıcı
