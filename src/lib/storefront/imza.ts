/**
 * STOREFRONT KÖPRÜ İMZASI — TEK DOĞRULAMA KAYNAĞI (#994753 · R3).
 *
 * ÖLÇÜLEN ARIZA (19 Eki 2026, Okan · P0-A): aynı Liquid imzası iki uçta FARKLI
 * doğrulanıyordu.
 *   · `addresses/route.ts` → `hmac(email)`                 (ham)
 *   · `reviews/verify.ts`  → `hmac(email.trim().toLowerCase())`
 * İmzayı üreten taraf tema: `{{ customer.email | hmac_sha256: BRIDGE_KEY }}`,
 * yani e-postayı Shopify'ın verdiği HÂLİYLE imzalar. Büyük harf içeren bir
 * `customer.email` için imza bir uçta geçerli, ötekinde geçersiz oluyordu ve
 * sonuç SESSİZDİ: `verifiedBuyer` hep `false` kalıyor, hiçbir hata görünmüyordu.
 *
 * ÇÖZÜM — ADAY KÜMESİ: doğrulama (ham | küçük harfli) × (yeni anahtar | eski
 * anahtar) adaylarını sabit-zamanlı karşılaştırır.
 *   · Ham DA kabul edilir ⇒ BUGÜNKÜ tema (filtresiz) çalışmaya devam eder;
 *     yalnız küçük harfe çevirmek canlıyı kırardı.
 *   · Küçük harfli DE kabul edilir ⇒ tema `| downcase` eklendiğinde kod
 *     değişikliği GEREKMEZ (tema basımı P1-A'nın işi).
 *   · Eski anahtar DA kabul edilir ⇒ R2 rotasyonu (P0-A raporu §3, 5 adım)
 *     kesinti üretmeden yapılabilir; geçiş bitince `STOREFRONT_BRIDGE_KEY_ESKI`
 *     silinir ve eski imza reddedilir.
 *
 * ⛔ HMAC GEÇERLİLİĞİ SATIN ALMA KANITI DEĞİLDİR. Yalnız "bu e-posta mağaza
 * oturumunda doğrulandı" der. "Doğrulanmış alıcı" etiketi için ayrıca TESLİM
 * EDİLMİŞ sipariş satırı aranır (bkz. reviews/route.ts).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Kısa/boş anahtar güvenilmezdir: imza doğrulaması YAPILMAZ, reddedilir. */
export const EN_AZ_ANAHTAR_UZUNLUGU = 32;

/** Temanın imzalamış olabileceği e-posta biçimleri — sıra güvenliği etkilemez. */
export function imzaAdaylari(email: string): string[] {
  const ham = email.trim();
  const kucuk = ham.toLowerCase();
  return ham === kucuk ? [ham] : [ham, kucuk];
}

export function imzaGecerliMi(
  email: string,
  imza: string | null | undefined,
  key: string | null | undefined,
  eskiKey?: string | null,
): boolean {
  if (!email || typeof imza !== 'string' || !/^[a-f0-9]{64}$/i.test(imza)) return false;
  const anahtarlar = [key, eskiKey]
    .map((k) => (k ?? '').trim())
    .filter((k) => k.length >= EN_AZ_ANAHTAR_UZUNLUGU);
  if (anahtarlar.length === 0) return false;
  const gelen = Buffer.from(imza, 'hex');
  for (const anahtar of anahtarlar) {
    for (const mesaj of imzaAdaylari(email)) {
      const beklenen = createHmac('sha256', anahtar).update(mesaj).digest();
      if (gelen.length === beklenen.length && timingSafeEqual(gelen, beklenen)) return true;
    }
  }
  return false;
}

/** Ortamdan okunan geçiş anahtarı — rotasyon boyunca DOLU, bitince silinir. */
export function eskiKopruAnahtari(): string | undefined {
  const d = (process.env.STOREFRONT_BRIDGE_KEY_ESKI ?? '').trim();
  return d.length >= EN_AZ_ANAHTAR_UZUNLUGU ? d : undefined;
}
