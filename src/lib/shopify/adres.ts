/**
 * Shopify'a giden teslimat/fatura adresini kuran TEK yer.
 *
 * Neden var (21 Eyl 2026, #1164 / #1169): ödeme sayfasındaki "Posta Kodu" kutusu
 * serbest metin ve biz onu Shopify'a olduğu gibi gönderiyorduk. Shopify siparişi
 * kaydederken İLİ posta kodunun ilk iki hanesinden (plaka) yeniden yazıyor:
 *   - #1164: Tokat/Erbaa seçildi, posta kodu "060"   → Shopify: Ankara (TR-06)
 *   - #1169: İstanbul/Şişli seçildi, posta kodu "12345" → Shopify: Bingöl (TR-12)
 * Etiket Shopify'daki ille basıldığı için kargo yanlış ile gidiyordu.
 *
 * Kural: posta kodu YALNIZ 5 haneliyse VE ilk iki hanesi seçilen ilin plakasına
 * eşitse gönderilir; değilse BOŞ gönderilir. Ödeme REDDEDİLMEZ — il/ilçe zaten
 * formdan doğru geliyor, posta kodu isteğe bağlı bir alan.
 *
 * Bu adres kurma kodu önceden dört yerde kopyaydı (create-storefront-order,
 * paytr/halkode/iyzico initialize); kopyalardan biri düzeltilip ötekiler
 * unutulmasın diye hepsi buradan kurar.
 */
import { provinceCode, provinceName } from './tr-provinces';

export interface AdresKaynagi {
  first_name: string;
  last_name: string;
  address1: string;
  address2?: string;
  city: string; // ilçe
  province: string; // il (ad ya da 'TR-XX')
  zip?: string;
}

/**
 * Posta kodunu seçilen ile göre süzer.
 * 5 hane değilse ya da ilk iki hane ilin plakası değilse '' döner.
 */
export function postaKodunuSuz(zip: string | null | undefined, ilKodu: string | null): string {
  const pk = (zip ?? '').trim();
  if (!/^\d{5}$/.test(pk)) return '';
  const plaka = /^TR-(\d{2})$/.exec(ilKodu ?? '')?.[1];
  if (!plaka) return '';
  return pk.slice(0, 2) === plaka ? pk : '';
}

export interface ShopifyAdresi {
  /** shipping_address / billing_address olarak gönderilecek nesne */
  adres: Record<string, unknown>;
  /** kanonik il adı */
  il: string;
  /** gönderilen province_code (TR-XX); il tanınmadıysa null */
  ilKodu: string | null;
  /** süzülmüş posta kodu ('' olabilir) */
  zip: string;
}

/**
 * @param telefon  null → phone alanı HİÇ gönderilmez (kapıda/havale yolu: geçersiz
 *                 telefon 422 'is invalid' vermesin). Dize ('' dahil) → olduğu gibi yazılır
 *                 (kart yolları taslakta boş dizeyle gönderiyordu; davranış korunuyor).
 */
export function shopifyAdresiKur(b: AdresKaynagi, telefon: string | null): ShopifyAdresi {
  // #615: form il alanında bazen ADI değil KODU ('TR-34') gönderiyor —
  // normalleştirmezsek Shopify'a kod yazılıyor ve PTT etiketine "TR-34" basılıyor.
  const il = provinceName(b.province);
  const ilKodu = provinceCode(il);
  const zip = postaKodunuSuz(b.zip, ilKodu);
  const adres: Record<string, unknown> = {
    first_name: b.first_name,
    last_name: b.last_name,
    ...(telefon !== null ? { phone: telefon } : {}),
    address1: b.address1,
    address2: b.address2 || '',
    city: b.city, // ilçe
    province: il, // il
    zip,
    country: 'Turkey',
    country_code: 'TR',
  };
  if (ilKodu) adres.province_code = ilKodu;
  return { adres, il, ilKodu, zip };
}
