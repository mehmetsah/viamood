/**
 * Merkezi CORS origin yönetimi — multi-tenant (marka başına instance) hazırlığı.
 *
 * ÖNCESİ: 12+ dosyada kopyala-yapıştır ALLOWED listeleri (4 viamood varyantı +
 * d3z34m-iw.myshopify.com hardcoded) — ikinci markada checkout/ödeme/köprüler kırılırdı.
 * SONRASI: liste STOREFRONT_URL + www/apex türevi + Shopify domain + EXTRA_ALLOWED_ORIGINS
 * env'inden türetilir. DEFAULT'lar mevcut canlı davranışı BİREBİR korur (Via Mood origin
 * seti aynı); ikinci instance yalnız kendi .env'ini doldurur.
 *
 * NOT: EXTRA_ALLOWED_ORIGINS bilinçli olarak process.env'den okunur (env.ts zod şemasına
 * eklenmedi — yan çalışma alanı env.ts'i düzenliyor, çakışmamak için; oraya taşıma sonra).
 */
import { env } from '@/lib/env';

let cached: string[] | null = null;

/** İzinli origin listesi (memoized). Array döner — mevcut kodlar .includes kullanıyor. */
export function getAllowedOrigins(): string[] {
  if (cached) return cached;
  const set = new Set<string>();

  const storefront = env.STOREFRONT_URL.replace(/\/$/, '');
  set.add(storefront);
  try {
    const u = new URL(storefront);
    if (u.hostname.startsWith('www.')) {
      set.add(`${u.protocol}//${u.hostname.slice(4)}`);
    } else {
      set.add(`${u.protocol}//www.${u.hostname}`);
    }
  } catch {
    /* geçersiz URL — sadece ham değer kalır */
  }

  if (env.SHOPIFY_STORE_DOMAIN) set.add(`https://${env.SHOPIFY_STORE_DOMAIN}`);

  // Türetilemeyen ek origin'ler (ör. viamood.com apex'i .com.tr'den türetilemez).
  // Default = bugünkü canlı liste → davranış birebir korunur. İkinci marka kendi env'inde ezer/boşaltır.
  const extra = process.env.EXTRA_ALLOWED_ORIGINS ?? 'https://viamood.com,https://www.viamood.com';
  for (const o of extra.split(',')) {
    const t = o.trim().replace(/\/$/, '');
    if (t) set.add(t);
  }

  cached = Array.from(set);
  return cached;
}

/** origin izinliyse kendisini, değilse STOREFRONT_URL'i döndürür (tek-origin CORS cevabı için). */
export function resolveCorsOrigin(origin: string | null | undefined): string {
  const allowed = getAllowedOrigins();
  return origin && allowed.includes(origin) ? origin : env.STOREFRONT_URL.replace(/\/$/, '');
}
