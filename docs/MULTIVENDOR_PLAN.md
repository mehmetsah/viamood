# Via Mood — Multi-Vendor Platform Plan

**Hedef:** Via Mood Shopify mağazasının yanında, tedarikçi (vendor) panelleri ve admin paneli içeren çok-satıcılı pazaryeri katmanı kurmak.

**Stratejik karar:** Shopify'ı storefront + checkout + ödeme katmanı olarak tutmak; vendor verisini, sipariş yönlendirme kararlarını, ledger'ı ve dashboard'ları kendi backend'imizde yönetmek.

---

## 1. Aktörler

| Aktör | Yetki |
|---|---|
| **Müşteri** | Shopify storefront'tan alışveriş yapar. Çok-satıcılı yapıyı görmez (deneyim tek mağaza gibi). |
| **Vendor (Tedarikçi)** | Kendi panelinden ürün/stok/sipariş/fulfillment yönetir. Sadece kendi verisini görür. |
| **Admin (biz)** | Her şeyi görür: vendor onay, sipariş yönlendirme kuralları, payout, anlaşmazlık çözümü. |

---

## 2. Vendor Dashboard Modülleri

1. **Dashboard** — bu hafta sipariş, gelir, bekleyen payout, hızlı eylemler
2. **Ürünler** — ekle/düzenle/sil (Shopify Admin API'ye senkronize), varyantlar, fiyat, görsel
3. **Stok** — vendor kendi stoğunu günceller, Shopify'a otomatik yansır
4. **Siparişler** — yalnız kendi line item'larını içeren siparişler, durum filtreleri
5. **Fulfillment** — KargoLab entegrasyonu üzerinden etiket basma, kargo durumu
6. **Payout & Ledger** — hak ediş, geçmiş ödemeler, fatura yükleme (cari mod için)
7. **Profil & KYC** — vergi levhası, IBAN, sözleşme imzalama
8. **Mesajlar** — vendor ↔ admin ↔ müşteri (sınırlı)
9. **Raporlar** — satış, en çok satan ürün, iade oranı

---

## 3. Admin Dashboard Modülleri

1. **Tüm Vendor'lar** — listele, detay, onay/red, askıya al
2. **Tüm Ürünler** — global görünüm, vendor filtresi
3. **Tüm Siparişler** — routing kararı, fulfillment durumu
4. **Routing Kuralları** — drag-drop kural editörü (4 mod)
5. **Komisyon Ayarları** — vendor başına oran (default %0)
6. **Payout Yönetimi** — onay, batch oluştur, banka export
7. **Anlaşmazlık** — ürün/iade/şikayet
8. **Raporlar & Analytics** — global metrikler
9. **Audit Log** — tüm admin işlemleri kayıtlı

---

## 4. Ödeme Modları (vendor başına seçilebilir)

### Mod A: Marketplace Split (otomatik)
- **Ne:** Müşteri checkout'ta öder → Iyzico/PayTR Pazaryeri API'si ödemeyi anında split eder → vendor'a ait kısım vendor IBAN'ına geçer (T+1)
- **Vendor onboarding:** Iyzico Submerchant / PayTR Bağlı Kuruluş kaydı (vergi levhası + IBAN + sözleşme)
- **Faturalama:** Vendor müşteriye doğrudan fatura keser
- **Komisyon:** Otomatik kesilir

### Mod B: Cari (manuel settlement)
- **Ne:** Müşteri bize öder → biz tutarız → periyodik (haftalık/aylık) vendor'a aktarırız
- **Vendor faturalama:** Vendor bize dropshipping faturası keser
- **Müşteri faturalama:** Biz keseriz
- **Payout:** Admin onaylı batch + banka export CSV

Vendor profil sayfasında `payment_mode: marketplace_split | cari` toggle.

---

## 5. Sipariş Yönlendirme — 4 Mod

```
Sipariş geldi → Line item'lar farklı vendor'lardan mı?
├── Tek vendor  → o vendor fulfill (default)
└── Çok vendor  → Routing engine kuralları sırayla değerlendirir
    ├── SPLIT             → her vendor kendi paketini gönderir, müşteriye N tracking
    ├── CONSOLIDATE_SELF  → vendor'lar bizim depoya gönderir, biz birleştirip yollarız
    ├── CONSOLIDATE_CARRIER → KargoLab/3PL multi-pickup ile birleştirir
    └── HYBRID            → vendor başına ayar (bazı vendor split, bazı consolidate)
```

### Routing kuralı faktörleri (admin panelden tanımlanır)
- Vendor preference
- Müşteri lokasyonu (şehir içi/dışı)
- Sipariş tutarı (eşik üstü consolidate)
- Toplam ağırlık/hacim
- Vendor sayısı
- Müşteri checkout tercihi (opsiyonel)

Her sipariş için karar bir kez hesaplanır, `routing_decisions` tablosuna yazılır, idempotent.

---

## 6. KargoLab Entegrasyonu

- Mevcut Shopify mağazasında zaten kurulu
- Etiketler KargoLab API'si ile basılır
- Mode 1: vendor kendi etiketini KargoLab'tan basar
- Mode 2: vendor → bizim depoya KargoLab; bizden müşteriye KargoLab
- Mode 3: KargoLab multi-pickup özelliği varsa direkt (API doc audit gerek)

---

## 7. Faz Planı

| Faz | Süre | Ana Çıktı |
|---|---|---|
| **0. Foundation** | 3-5 gün | Repo, docs, DB schema, NextAuth, base UI, Drizzle migrations |
| **1. Vendor Auth + Onboarding** | 1.5 hafta | Email/pass + magic + Google login, KYC formu, admin onay flow'u |
| **2. Vendor Dashboard MVP** | 1.5 hafta | Ürün CRUD (Shopify sync), stok, kendi siparişlerini görme |
| **3. Order Routing Engine** | 1 hafta | Webhook listener, 4-mode routing, admin kural editörü |
| **4. Fulfillment Workflow** | 1 hafta | KargoLab etiket basma, tracking, müşteri bildirimi |
| **5. Payment + Payout** | 1.5 hafta | Iyzico Pazaryeri, cari mode payout ledger, banka export |
| **6. Polish + Go-live** | 1 hafta | Bug fix, vendor onboarding rehberi, dokümantasyon |

**Toplam: ~7-8 hafta**

---

## 8. Ölçek Kademeleri

Mimariyi başından **milyon kullanıcıya çıkabilir** şekilde kuruyoruz; ama kademeli scale-up:

| Tier | Hacim | Altyapı | ~Aylık Maliyet |
|---|---|---|---|
| **0 (Start)** | 0-50K sipariş/ay | Tek Postgres + tek Redis + Vercel | $100-200 |
| **1 (Growth)** | 50K-500K sipariş/ay | + read replica, ayrı worker, Meilisearch | $1K-3K |
| **2 (Scale)** | 500K+ sipariş/ay | Partition'lı Postgres, multi-region read, event bus | $5K-20K |

Tier 0'daki şema/key kararları Tier 2'ye taşınabilir (UUID v7, append-only event log, partition-ready DDL).

---

## 9. Açık Konular (Faz 0 boyunca cevap aranacak)

- KargoLab API'sinde multi-pickup var mı? (Mode 3 fizibilitesi)
- Iyzico Pazaryeri vs PayTR Bağlı Kuruluş — final seçim (öneri: Iyzico)
- e-Fatura entegrasyonu hangi sağlayıcı ile? (BMG, Foriba, Mikro vs.)
- Vendor sözleşme + KVKK aydınlatma metni hukuki onay
- İlk vendor onboarding'de hangi evraklar zorunlu (vergi levhası, imza sirküleri, ticaret sicil)

---

## 10. Anahtar Performans Göstergeleri (KPI)

- **Vendor onboarding süresi**: hedef <48 saat (KYC dahil)
- **Sipariş routing hesabı**: <500ms p95
- **Vendor dashboard ilk sayfa açılış**: <1s p95
- **Fulfillment SLA**: sipariş → kargoya, vendor için <24 saat
- **Payout SLA**: dönem sonu → ödeme, max 5 iş günü
