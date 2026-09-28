/**
 * ÜRÜN SSS — saf doğrulama ve sıralama. Veritabanı/HTTP bağımlılığı YOK (#991833).
 *
 * Ayrı dosya çünkü bu kuralları hem admin eylemi hem yayın ucu kullanıyor; iki
 * yerde ayrı yazılsa biri güncellenmeyince sessizce ayrışır (bu deponun ölçülmüş
 * "kopya = sessiz kayma" sınıfı).
 */
export const SORU_EN_UZUN = 200;
export const CEVAP_EN_UZUN = 2000;

export type SssGirdi = { soru?: string | null; cevap?: string | null; sira?: number | string | null };
export type SssKayit = { soru: string; cevap: string; sira: number };

/** Handle'ı ürün adresindeki biçime indirir; geçersizse boş dize. */
export function handleTemizle(v: string | null | undefined): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/^products\//, '')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Girdiyi kayda çevirir. Hata varsa `{hata}` döner — çağıran 422 basar.
 *
 * ⚠ HTML KABUL EDİLMEZ: cevap düz metin olarak saklanır ve ekranda kaçışlı basılır.
 * Zengin metne izin vermek, admin panelinden ürün sayfasına script sokulabilmesi
 * demektir (stored XSS); SSS için kazancı yok, riski var.
 */
export function sssDogrula(g: SssGirdi): { kayit: SssKayit } | { hata: string } {
  const soru = String(g.soru ?? '').trim().replace(/\s+/g, ' ');
  const cevap = String(g.cevap ?? '').trim();
  if (!soru) return { hata: 'soru boş olamaz' };
  if (!cevap) return { hata: 'cevap boş olamaz' };
  if (soru.length > SORU_EN_UZUN) return { hata: `soru en çok ${SORU_EN_UZUN} karakter` };
  if (cevap.length > CEVAP_EN_UZUN) return { hata: `cevap en çok ${CEVAP_EN_UZUN} karakter` };
  if (/<[a-z/][^>]*>/i.test(soru) || /<[a-z/][^>]*>/i.test(cevap)) {
    return { hata: 'HTML etiketi kabul edilmiyor — düz metin yazın' };
  }
  const n = Number(g.sira ?? 0);
  const sira = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  return { kayit: { soru, cevap, sira } };
}

/**
 * Ekran sırası: `sira` artan, eşitlik hâlinde soru alfabetik (Türkçe).
 * Eşitlik hâli tabloda tekil kısıtla engellenmiş olsa da, eski kayıtlar ya da
 * göç öncesi veri için sıralama YİNE DE belirli olmalı — belirsiz sıra, aynı
 * sayfanın iki yüklemede farklı görünmesi demektir.
 */
export function sssSirala<T extends { sira: number; soru: string }>(liste: T[]): T[] {
  return [...liste].sort((a, b) => (a.sira - b.sira) || a.soru.localeCompare(b.soru, 'tr'));
}

/** Sıra numaralarını 0,1,2… olarak yeniden dizer (silme sonrası boşlukları kapatır). */
export function siralariSikistir<T extends { sira: number; soru: string }>(liste: T[]): T[] {
  return sssSirala(liste).map((k, i) => ({ ...k, sira: i }));
}
