/**
 * Taksit tavanı — TEK KAYNAK.
 *
 * Yunus, 29 Eyl 2026 (Viamood Proje Grubu, acil): "Taksit sayımız maksimum 3 ile
 * kısıtlı olmalı … vade farkı olmaksızın". O güne kadar hiçbir yerde tavan yoktu:
 * HalkÖde POS tanımı 12 seçeneğin hepsini vade farksız döndürdüğü için kart formu
 * 12 satırı birden çiziyordu (ölçüldü: Tek çekim + 2…12, hepsi 1.000,00 TL).
 *
 * ⚠ Bu sabit "listeyi uydur" demek DEĞİLDİR. Liste yine API'den gelir; üzerine iki
 * süzgeç uygulanır: (a) ödenecek tutar sepet tutarına EŞİT olacak (vade farksız),
 * (b) taksit sayısı bu tavanı aşmayacak. API 2 veya 3'ü döndürmüyorsa onlar da
 * gösterilmez — gösterim API'nin ÜSTÜNE çıkmaz, yalnız daraltır.
 *
 * Değeri burada değiştirmek dört yüzü birden günceller: installments ucu (otorite),
 * initialize ucu (reddetme kapısı), storefront ödeme formu, Halköde deneme formu.
 */
export const MAKS_TAKSIT = 3;

/** API'den gelen bir taksit seçeneği tavanın içinde mi? */
export function taksitGecerli(installmentsNumber: unknown): boolean {
  const n = Number(installmentsNumber) || 1;
  return Number.isFinite(n) && n >= 1 && n <= MAKS_TAKSIT;
}
