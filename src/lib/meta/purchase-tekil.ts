/**
 * PURCHASE TEKİLLEŞTİRME — saf mantık, tarayıcı API'si yok. (#991406, 27 Eyl 2026)
 *
 * NEDEN AYRI DOSYA: tekilleştirme kararı çivilenebilmeli. Tema içindeki Liquid
 * yaması bu kuralın AYNISINI uygular; buradaki fonksiyon o kuralın ölçülebilir
 * karşılığıdır ve çivi ikisini birlikte tutar.
 *
 * ÖLÇÜLEN AKIŞ (canlı /pages/odeme, 27 Eyl 2026):
 *   vmTesekkureGit(d, yontem) → kod = d.order_code || d.order_name
 *   sessionStorage['vm_siparis_sonuc_'+kod] = {html, yontem, ts}
 *   → /pages/siparis-alindi?order=<kod>&yontem=<y>
 * Yani başarı anı ÖDEME SAYFASINDA doğuyor, gösterim AYRI sayfada. Purchase'ı
 * yalnız başarı sayfasına koymak yanlış olurdu: orada TUTAR yok (sessionStorage
 * sadece html/yontem/ts taşıyor) ve `fbq` o sayfada hiç tanımlı değil (ölçüldü: 0).
 *
 * ⚠ SAYFA YENİLENİNCE İKİNCİ PURCHASE DOĞMAMALI. Damga `localStorage`'da tutulur,
 * `sessionStorage`'da DEĞİL: kullanıcı sekmeyi kapatıp aynı adrese dönerse
 * sessionStorage silinir ve olay ikinci kez doğardı — ciro iki katı görünürdü.
 */

/** Meta deduplication anahtarı. CAPI sunucu olayı da aynı id ile gönderilirse Meta tekilleştirir. */
export function purchaseEventId(siparisKodu: string): string {
  const k = String(siparisKodu || '').trim().replace(/^#/, '');
  return k ? 'vmp-' + k : '';
}

/** localStorage damga anahtarı. */
export function purchaseDamgaAnahtari(siparisKodu: string): string {
  const k = String(siparisKodu || '').trim().replace(/^#/, '');
  return k ? 'vm_fb_purchase_' + k : '';
}

export type DepoOku = (anahtar: string) => string | null;

/**
 * Bu sipariş için Purchase gönderilmeli mi?
 *
 * `false` dönen üç hâl: kod yok · damga var (zaten gönderildi) · değer geçersiz.
 * Değer kapısı bilinçli: `value: 0` giden bir Purchase, Meta'da dönüşümü
 * "değersiz" kaydeder ve reklam optimizasyonunu bozar.
 */
export function purchaseGonderilmeli(
  siparisKodu: string,
  toplamKurus: number,
  oku: DepoOku,
): boolean {
  const anahtar = purchaseDamgaAnahtari(siparisKodu);
  if (!anahtar) return false;
  if (!Number.isFinite(toplamKurus) || Math.round(toplamKurus) <= 0) return false;
  let damga: string | null = null;
  try {
    damga = oku(anahtar);
  } catch {
    // Depo kapalıysa (gizli sekme/izin) tekilleştirme YAPILAMAZ. Olayı GÖNDERİRİZ:
    // eksik ölçüm, yanlış ölçümden iyidir ve Meta eventID ile kendi tarafında
    // tekilleştirir (aynı id iki kez gelirse tek sayar).
    return true;
  }
  return !damga;
}
