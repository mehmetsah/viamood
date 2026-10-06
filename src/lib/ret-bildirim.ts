/**
 * Yetki reddi bildirimi — TEK KAYNAK (#992119-H).
 *
 * ⚠ NEDEN ÇEREZ VAR — 29 Eyl 2026 G turunda ÖLÇÜLDÜ:
 * Middleware reddi `?hata=yetkisiz` ile taşıyordu. GET yolunda çalışıyordu
 * (`/hesabim?hata=yetkisiz`, metin ekranda görünüyordu) ama **server action POST**
 * yolunda parametre kayboluyordu: Next, action'a gelen yönlendirme yanıtını kendi
 * protokolüyle işliyor ve sorgu dizesi tarayıcıya taşınmıyor. Sonuç: form gönderen
 * kullanıcı sessizce kendi sayfasına düşüyordu ("tıkladım, hiçbir şey olmadı").
 *
 * Bu yüzden anahtar AYRICA tek seferlik bir çerezle taşınır. Sorgu parametresi de
 * KALDI — iki yol birbirini tamamlar, biri düşerse öteki çalışır.
 *
 * ⚠ ALTERNATİF REDDEDİLDİ: middleware'in action POST'unu geçirip kararı KAPI 3'e
 * bırakmak da mesajı taşırdı ama yetki kapısını gevşetirdi. Güvenlik freni gevşetilmez.
 *
 * KURALLAR:
 *  · Çerez ve URL **yalnız ANAHTAR** taşır, metnin kendisini ASLA taşımaz.
 *    Metin hedef sayfada sabittir; böylece dışarıdan içerik enjekte edilemez.
 *  · Tanınmayan anahtar → hiçbir şey gösterilmez.
 *  · Metin hiçbir iç ayrıntı vermez (tablo/sütun adı, rol adı, kaydın varlığı,
 *    stack, digest) — çivi tek tek doğrular.
 */

/** Çerez adı. */
export const RET_CEREZI = 'vm_ret';

/** Taşınan tek anahtar. Metin DEĞİL. */
export const RET_ANAHTARI = 'yetkisiz';

/** Tek seferlik: sayfa okuyunca silinir, okunmazsa bu süre sonunda düşer. */
export const RET_CEREZ_OMRU = 60;

/**
 * Anahtar → SABİT metin. Server action'daki `YETKISIZ_METNI` ile birebir aynı olmalı
 * (çivi karşılaştırır); kullanıcı hangi kapıdan dönerse dönsün aynı cümleyi görür.
 */
export const RET_METINLERI: Record<string, string> = {
  yetkisiz: 'Bu işlem için yetkiniz yok. Yetki talebi için yöneticinize başvurun.',
};

export function retMetni(anahtar: string | null | undefined): string | null {
  if (!anahtar) return null;
  return RET_METINLERI[anahtar] ?? null;
}
