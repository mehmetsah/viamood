/**
 * Takip numarası doğrulaması — SAF mantık, bağımlılığı yok.
 *
 * Ayrı dosyada duruyor çünkü `shipments.ts` ortam değişkenlerine bağlı
 * (`internal.ts` → `env.ts`) ve bu kural onsuz, birim testiyle çivilenebilmeli.
 */
/**
 * TAKİP NUMARASI MI, BİZİM REFERANSIMIZIN YANSIMASI MI?
 *
 * ÖLÇÜLEN ARIZA (22 Eyl 2026, prod): 123 gönderinin 10'unda `tracking_number`
 * alanına "#1056", "#1101" gibi BİZİM SİPARİŞ NUMARAMIZ yazılmıştı. Kök neden
 * isim çakışması: `/shipment-create` isteğinde `tracking_number` alanı bir
 * REFERANS alanıdır (bkz. ShipmentCreateInput) ve fulfillment-service oraya
 * `order.orderName` koyuyor. Kurye barkodu üretilemediğinde (kontör/kredi yok,
 * kurye API hatası) KargoLab bu değeri yanıtta AYNEN geri yansıtıyor; eski kod
 * da onu takip numarası sanıp DB'ye yazıyordu.
 *
 * Sonuç: müşteri takip edemiyor, kargo sitesi "kayıt bulunamadı" diyor —
 * numara "kaybolmuş" gibi görünüyor. Sahte numara yazmaktansa BOŞ bırakmak
 * dürüst: order-track zaten takip numarası olmayan satırı gizleyip
 * "Hazırlanıyor" diyor.
 *
 * İki kapı birden: (a) istekte gönderdiğimiz referanslardan biriyle aynıysa
 * reddet, (b) kurye barkodu yalnız rakamlardan oluşur — "#1056" değildir.
 */
export function gercekTakipNo(
  aday: string | null | undefined,
  referanslar: Array<string | null | undefined>,
): string | null {
  const v = (aday ?? '').trim();
  if (!v) return null;
  const ref = new Set(referanslar.map((r) => (r ?? '').trim()).filter(Boolean));
  if (ref.has(v)) return null;          // bizim referansımızın yansıması
  if (!/^[0-9]{6,}$/.test(v)) return null; // kurye barkodu yalnız rakam (en az 6 hane)
  return v;
}
