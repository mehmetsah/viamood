/**
 * META PIXEL OLAY YÜKÜ — SAF mantık, tarayıcı/ağ bağımlılığı YOK.
 *
 * NEDEN AYRI DOSYA: değeri üreten mantık çivilenebilmeli. Gönderim tarafı
 * (`fbq`) yalnız tarayıcıda çalışır; hesap doğruluğu birim testiyle ölçülür.
 *
 * ÖLÇÜLEN ARIZA (26 Eyl 2026, Elif · canlı Chrome, viamood.com.tr):
 *   ViewContent  → value=500 currency=TRY ✅ ama `contents` YOK
 *   AddToCart    → value=500 currency=TRY ✅ ama `contents` YOK
 *   /pages/odeme → yalnız PageView; InitiateCheckout ve Purchase HİÇ doğmuyor
 * Kök neden: Shopify'ın kendi checkout'u kullanılmıyor (tema içi /pages/odeme),
 * Web Pixel `checkout_started`/`checkout_completed` yalnız kendi checkout'unda
 * yayınlanıyor. Sonuç: Meta'ya DÖNÜŞÜM DEĞERİ hiç ulaşmıyor.
 *
 * KURAL (Yunus'un isteği): değer Shopify/Event Setup Tool'a BIRAKILMAZ, olayda
 * doğrudan gönderilir — value sayısal, currency 'TRY', contents id+quantity+item_price.
 */
export const PARA_BIRIMI = 'TRY';

export type SepetKalemi = {
  /** Meta katalog kimliği — varyant kimliği (katalogda retailer_id varyant bazlıdır). */
  variant_id: string | number;
  quantity: number;
  /** SATIR toplamı, KURUŞ (sepet bu biçimde tutuyor: line_price_cents). */
  line_price_cents: number;
};

export type OlayYuku = {
  value: number;
  currency: string;
  content_type: 'product';
  content_ids: string[];
  contents: { id: string; quantity: number; item_price: number }[];
  /** Kalem toplamı ile value arasındaki kuruş sapması — 0 olmalı, ölçülebilir kalsın. */
  sapma_kurus: number;
};

/** Kuruş → TL, 2 ondalık. Kayan nokta birikmesin diye tek noktadan geçer. */
export function tlye(kurus: number): number {
  return Math.round(kurus) / 100;
}

/**
 * BİRİM fiyat, kuruş. Satır toplamını adede bölerken kuruş artabilir;
 * artan `sapma_kurus` olarak görünür, sessizce yutulmaz.
 */
function birimKurus(k: SepetKalemi): number {
  return k.quantity > 0 ? Math.round(k.line_price_cents / k.quantity) : 0;
}

/**
 * Sepet olay yükü (AddToCart · InitiateCheckout · Purchase).
 *
 * `toplamKurus` ÖDENECEK tutardır (kargo dâhil, indirim düşülmüş) ve value onunla
 * kurulur — kalem toplamıyla DEĞİL. Halköde'de tam tersini yapmak `status_code=13`
 * üretmişti: orada kalem toplamı fatura toplamına eşit değildi ve ödeme reddedildi.
 * Burada ödeme reddi olmaz ama Meta'ya yanlış ciro gider; ikisi de sessiz hatadır,
 * o yüzden fark `sapma_kurus` alanında AÇIKÇA taşınır.
 */
export function sepetYuku(kalemler: SepetKalemi[], toplamKurus: number): OlayYuku {
  const temiz = (kalemler ?? []).filter((k) => k && k.quantity > 0);
  const contents = temiz.map((k) => ({
    id: String(k.variant_id),
    quantity: k.quantity,
    item_price: tlye(birimKurus(k)),
  }));
  const kalemToplamKurus = temiz.reduce((s, k) => s + birimKurus(k) * k.quantity, 0);
  return {
    value: tlye(toplamKurus),
    currency: PARA_BIRIMI,
    content_type: 'product',
    content_ids: contents.map((c) => c.id),
    contents,
    sapma_kurus: Math.round(toplamKurus) - kalemToplamKurus,
  };
}

/** Tek ürün olay yükü (ViewContent). */
export function urunYuku(variantId: string | number, birimFiyatKurus: number): OlayYuku {
  return sepetYuku([{ variant_id: variantId, quantity: 1, line_price_cents: birimFiyatKurus }], birimFiyatKurus);
}

/**
 * GÖNDERİM KAPISI — değeri olmayan olay Meta'ya GİTMEZ.
 *
 * Sebep: `value: 0` ya da `undefined` giden bir Purchase, Meta'da dönüşümü
 * "değersiz" kaydeder ve reklam optimizasyonunu bozar; hiç göndermemek daha
 * dürüsttür. Kapının kendisi çivilidir (tests/meta-pixel-deger.test.ts).
 */
export function gonderilebilir(y: Partial<OlayYuku> | null | undefined): boolean {
  if (!y) return false;
  if (typeof y.value !== 'number' || !Number.isFinite(y.value) || y.value <= 0) return false;
  if (y.currency !== PARA_BIRIMI) return false;
  return Array.isArray(y.content_ids) && y.content_ids.length > 0;
}
