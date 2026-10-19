import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Storefront müşteri imzası: bilinen/public/sabit secret kabul edilmez.
 * HMAC doğrulaması tek başına satın alma kanıtı sayılmaz; ayrıca orders ile
 * TESLİM eşleşmesi aranmalıdır.
 */
export function imzaGecerliMi(email: string, imza: string, key: string | undefined): boolean {
  if (!key || key.length < 32 || !email || !/^[a-f0-9]{64}$/i.test(imza)) return false;
  const beklenen = createHmac('sha256', key).update(email.trim().toLowerCase()).digest();
  const gelen = Buffer.from(imza, 'hex');
  return gelen.length === beklenen.length && timingSafeEqual(gelen, beklenen);
}
