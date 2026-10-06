/**
 * Marka kimliği tek kaynağı — multi-tenant (marka başına instance) hazırlığı.
 *
 * Müşteri-görünür marka adı/iletişim bilgileri buradan okunur; default'lar Via Mood
 * (mevcut canlı davranış birebir). İkinci marka kendi .env'inde ezer:
 *   BRAND_NAME, SUPPORT_EMAIL, VENDOR_SUPPORT_EMAIL
 *
 * NOT: bilinçli olarak process.env'den okunur (env.ts zod şemasına eklenmedi — yan
 * çalışma alanı env.ts'i düzenliyor, çakışmamak için; oraya taşıma sonra).
 * APP_NAME (panel adı) env.ts'te zaten mevcut — o ayrı: BRAND_NAME müşteri-görünür addır.
 */
import { env } from '@/lib/env';

/** Müşteri-görünür marka adı (mail konuları, makbuz metinleri, vendor fallback'i). */
export const BRAND_NAME = process.env.BRAND_NAME ?? 'Via Mood';

/** Müşteri destek e-postası (hesap sayfaları, iletişim linkleri). */
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'destek@viamood.com';

/** Tedarikçi iletişim e-postası (başvuru mailleri, vendor panel). */
export const VENDOR_SUPPORT_EMAIL = process.env.VENDOR_SUPPORT_EMAIL ?? 'vendor@viamood.com';

/**
 * Müşteri sipariş-takip linki — GÜNCEL hesap ekranına gider (#991987).
 *
 * ÖNCESİ: `${STOREFRONT_URL}/pages/siparis-takip?order=…&email=…`
 * `/pages/…` Shopify'ın SAYFA yoludur; yani mailde verdiğimiz takip linki müşteriyi
 * ESKİ Shopify temalı sayfaya götürüyordu. Yunus'un 28 Eyl 12:24 şikâyeti tam bu.
 *
 * SONRASI: `${APP_URL}/hesabim?siparis=…` — Next tarafındaki güncel hesap ekranı.
 *
 * ⚠ TAŞINAN PARAMETRE: sipariş referansı `siparis` adıyla KORUNUR (eski adı `order`).
 * ⚠ DÜŞÜRÜLEN PARAMETRE: `email`. Bilerek — eski sayfada e-posta MİSAFİR SORGUSUNUN
 *   kimlik kanıtıydı (giriş yapmadan sipariş görmek için). /hesabim'da kimliği OTURUM
 *   belirler, dolayısıyla e-posta hem gereksiz hem de URL'de taşınması sızıntıdır
 *   (mail iletilince başkasının eline geçer, sunucu/erişim kütüklerine düşer).
 *
 * ⚠ ÖLÇÜLEN DAVRANIŞ DEĞİŞİKLİĞİ: /hesabim GİRİŞ İSTER (src/app/hesabim/layout.tsx).
 *   Hesabı olmayan misafir artık siparişini görmek için giriş yapmak zorunda; eski
 *   sayfa order+email ile girişsiz gösteriyordu. Kendi tarafımızda girişsiz takip
 *   EKRANI YOK — `/api/v1/order-track` yalnız API, UI'ı Shopify sayfasındaydı.
 *   Bu kayıp Mehmet'in kararına bırakıldı (rapor: #991987), yeni ekran bu turda açılmadı.
 */
export function trackingPageUrl(orderRef: string, _email: string): string {
  const base = env.APP_URL.replace(/\/$/, '');
  return `${base}/hesabim?siparis=${encodeURIComponent(orderRef)}`;
}
