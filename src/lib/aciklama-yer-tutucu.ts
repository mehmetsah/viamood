/**
 * #994831 · AÇIKLAMA YAZMA KAPISI — yer tutucu / iç not taşıyan açıklama Shopify'a YAZILAMAZ (md.52).
 *
 * ÖLÇÜLEN OLAY (1 Kas 2026, Elif): SSS tarafı kapandıktan sonra aynı sınıf ürün açıklamalarında kaldı —
 * m-bison «Model kodu 34XXX (kutudaki EAN'ı gir)» · 3 Hot Wheels F1 2025 2'li «Güvenlik Uyarısı ___ (kutudaki yaş
 * bilgisine göre doldur)». Süzgeç SSS'in iki yazma kapısına bağlıydı, açıklamanınkine değil.
 *
 * Desenler sss-yer-tutucu.ts'den aynen gelir (ikinci liste yazılmaz); açıklama önce düz metne çevrilir.
 * Ön ölçüm: 1223 ürünün (505 aktif) açıklamasında yakalanan tam 4 = yukarıdaki 4 kalem, yanlış alarm 0.
 * Bağlı olduğu yer: açıklama yazan HER betiğin `yaz` adımı (scripts/aciklama-*.mts) — çivi bunu dosya dosya ölçer.
 *
 * Çivi: tests/aciklama-yer-tutucu.test.ts.
 */
import { duzMetin } from './aciklama-ic-not';
import { yerTutucuBul } from './sss-yer-tutucu';

export const aciklamaYerTutucuBul = (html: string) => yerTutucuBul(duzMetin(html));

/** Açıklama yazmadan HEMEN önce çağrılır; yer tutucu varsa yazma koşmaz, sebep `hata` alanında döner. */
export function aciklamaYazKapisi(html: string): { ok: true } | { ok: false; hata: string } {
  const y = aciklamaYerTutucuBul(html);
  return y.length ? { ok: false, hata: `yer tutucu / iç not taşıyan açıklama yazılmaz (${y.join(', ')})` } : { ok: true };
}
