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

/** Müşteri kargo-takip sayfası URL'i — tema /pages/siparis-takip (STOREFRONT_URL bazlı). */
export function trackingPageUrl(orderRef: string, email: string): string {
  const base = env.STOREFRONT_URL.replace(/\/$/, '');
  return `${base}/pages/siparis-takip?order=${encodeURIComponent(orderRef)}&email=${encodeURIComponent(email)}`;
}
