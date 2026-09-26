/**
 * POS KALEM ADI — güvenli kesme. SAF mantık, bağımlılığı yok.
 *
 * ÖLÇÜLEN İKİ SAPMA (26 Eyl 2026, Elif · #991458):
 *
 * 1) `name.slice(0, 100)` KARAKTER keser, BYTE değil. Türkçe harfler UTF-8'de
 *    2 byte: 'ı'=c4b1 'ş'=c59f 'ğ'=c49f 'Ç'=c387. Ölçüm: 81 karakterlik bir ad
 *    slice(0,100)'den sonra 81 karakter ama **161 BYTE** kalıyor. POS alan sınırı
 *    byte cinsindense sessizce taşar — ve taşma hatası kalem adında değil TUTAR
 *    doğrulamasında görünür, yani yanlış yerde aranır.
 *
 * 2) Kesme YARIM SURROGATE bırakabilir. Ölçüm: 99 harf + bir emoji için
 *    slice(0,100) son kod birimini yarım bırakıyor (`/[\uD800-\uDBFF]$/` doğru).
 *    Yarım surrogate UTF-8'e çevrilirken U+FFFD olur; gövde bozulur.
 *
 * ⚠ TÜRKÇE KARAKTERLER BOZULMUYOR — bu ayrıca ölçüldü: gövde `JSON.stringify` ile
 * üretiliyor ve "Kırılmaz" UTF-8 imzası `4bc4b172c4b16c6d617a` gövdede AYNEN var.
 * Yani sorun kodlama değil KESME. Çivi bu ayrımı HEX sabitiyle tutar; round-trip
 * karşılaştırması simetrik bozulmaya KÖRDÜR (#991433 dersi).
 */

/** POS `name` / `description` alanı için üst sınır (byte). */
export const KALEM_ADI_BAYT_SINIRI = 100;

/**
 * Adı en fazla `sinir` BYTE'a indirir; karakteri ortadan bölmez.
 *
 * Neden byte: sınırı aşan gövdeyi POS reddettiğinde hata mesajı tutar alanını
 * gösteriyor, adı değil. Neden karakteri bölmemek: yarım UTF-8 dizisi gövdeyi
 * geçersiz kılar. İkisi birlikte çözülür — tek geçişte, kütüphanesiz.
 */
export function kalemAdiKirp(ad: string | null | undefined, sinir = KALEM_ADI_BAYT_SINIRI): string {
  const s = String(ad ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  // Yarım surrogate'leri baştan at: kaynakta bozuk gelen veri de temizlenir.
  const guvenli = [...s].join('');
  if (Buffer.byteLength(guvenli, 'utf8') <= sinir) return guvenli;

  let bayt = 0;
  let cikti = '';
  // `for…of` kod NOKTASI üzerinde yürür (kod birimi değil) — surrogate çifti
  // asla ortadan bölünmez.
  for (const kn of guvenli) {
    const b = Buffer.byteLength(kn, 'utf8');
    if (bayt + b > sinir) break;
    cikti += kn;
    bayt += b;
  }
  return cikti.trimEnd();
}
