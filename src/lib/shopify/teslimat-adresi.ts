/**
 * Shopify `shipping_address` → `orders.shippingAddress` (DB) eşlemesi — TEK yer.
 *
 * ⚠️ TERS ADLANDIRMA (her yerde geçerli): `city` = İLÇE (Shopify city),
 * `district` = İL (Shopify province).
 *
 * Sipariş alımı (order-ingest) ve etiket kapısı (fulfillment-service, operasyon
 * Shopify'da adresi düzelttiğinde güncel adresi yeniden okurken) aynı eşlemeyi
 * kullanır; iki kopya olsaydı biri değişip öteki kayardı.
 */
export interface ShopifyTeslimatAdresi {
  name?: string | null;
  phone?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  country?: string | null;
  country_code?: string | null;
}

export interface TeslimatAdresiKaydi {
  name?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  district?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
}

export function teslimatAdresiKaydi(sa: ShopifyTeslimatAdresi | null | undefined): TeslimatAdresiKaydi | null {
  if (!sa) return null;
  return {
    name: sa.name ?? undefined,
    phone: sa.phone ?? undefined,
    address1: sa.address1 ?? undefined,
    address2: sa.address2 ?? undefined,
    city: sa.city ?? undefined,
    district: sa.province ?? undefined,
    postalCode: sa.zip ?? undefined,
    country: sa.country ?? undefined,
    countryCode: sa.country_code ?? undefined,
  };
}
