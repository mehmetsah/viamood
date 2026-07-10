/**
 * TR telefon normalizasyonu + Shopify hatalarını Türkçe'ye çevirme.
 *
 * Shopify order/customer phone alanı E.164 ister — "555 123 45 67" gibi girişler
 * {"errors":{"phone":["is invalid"]}} ile 422 düşürüyordu (müşteriye ham JSON sızdı).
 */

/** "0555 123 45 67" | "5551234567" | "+90 555..." → "+905551234567"; kurtarılamıyorsa null */
export function normalizeTrPhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  let d = digits;
  if (d.startsWith('0090')) d = d.slice(4);
  else if (d.startsWith('90') && d.length >= 12) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) return `+90${d}`;
  return null;
}

/** Shopify hata gövdesini müşteriye gösterilebilir TÜRKÇE mesaja çevirir. */
export function shopifyErrorToTr(status: number, bodyText: string): string {
  const FIELD_TR: Record<string, string> = {
    phone: 'Telefon numarası geçersiz — 5XX XXX XX XX formatında girin',
    email: 'E-posta adresi geçersiz',
    line_items: 'Sepetteki ürünlerden biri artık mevcut değil',
    quantity: 'Ürün adedi geçersiz ya da stok yetersiz',
    shipping_address: 'Teslimat adresi eksik ya da hatalı',
    billing_address: 'Fatura adresi eksik ya da hatalı',
    zip: 'Posta kodu geçersiz',
    discount_codes: 'İndirim kodu geçersiz ya da süresi dolmuş',
  };
  try {
    const parsed = JSON.parse(bodyText) as { errors?: Record<string, string[] | string> | string };
    const errs = parsed.errors;
    if (typeof errs === 'string') return `Sipariş oluşturulamadı: ${errs}`;
    if (errs && typeof errs === 'object') {
      const parts = Object.keys(errs).map((k) => FIELD_TR[k] ?? `${k} alanı hatalı`);
      if (parts.length) return parts.join(' · ');
    }
  } catch {
    /* JSON değilse genel mesaja düş */
  }
  if (status === 429) return 'Sistem şu an yoğun — lütfen birkaç saniye sonra tekrar deneyin';
  return 'Sipariş oluşturulamadı — lütfen bilgilerinizi kontrol edip tekrar deneyin';
}
