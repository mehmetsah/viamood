/**
 * Taksit tavanı — TEK YAPILANDIRMA DEĞERİ.
 *
 * Yunus, 29 Eyl 2026 12:27 (Viamood Proje Grubu): "3 taksit ile sınırlayalım, Dilan
 * Hanıma mail atıp neden tüm taksitlerde vade farksız geldiğini sorup dönüş yapacağım
 * sonrasında duruma göre değişiklik yapabiliriz."
 *
 * ⚠ Bu değer DEĞİŞECEK — Dilan Hanım'dan vade farkı cevabı gelince Yunus yeni bir sayı
 * verebilir. O yüzden sayı hiçbir yere gömülmedi; buradan okunur ve `HALKODE_MAKS_TAKSIT`
 * ortam değişkeniyle DEPLOY'SUZ değiştirilebilir (.env.production + pm2 restart yeter).
 *
 * ⚠ Bu bir GÖSTERİM ve KABUL sınırıdır, vade farkı ayarı DEĞİLDİR. Oran/komisyon
 * tarafına dokunulmaz — o soru bankada (Dilan Hanım), bizim işimiz değil.
 *
 * Liste yine API'den gelir; üstüne iki süzgeç uygulanır:
 *   (a) ödenecek tutar sepet tutarına EŞİT (vade farksız — mevcut süzgeç, korundu),
 *   (b) taksit sayısı <= MAKS_TAKSIT.
 * Süzgeç listeyi yalnız DARALTIR: API 2 veya 3'ü döndürmüyorsa onlar da gösterilmez,
 * olmayan taksit ÜRETİLMEZ.
 */

/** Varsayılan tavan — Yunus'un 29 Eyl kararı. */
export const VARSAYILAN_MAKS_TAKSIT = 3;

function tavaniOku(): number {
  const ham = process.env.HALKODE_MAKS_TAKSIT;
  if (!ham) return VARSAYILAN_MAKS_TAKSIT;
  const n = Number(ham);
  // Bozuk değer sessizce 1'e düşmesin de, sınırsıza da açılmasın: ikisi de müşteriye
  // yanlış ekran gösterir. Geçersizse varsayılana dön ve GÜRÜLTÜ ÇIKAR.
  if (!Number.isInteger(n) || n < 1 || n > 12) {
    console.warn('[halkode] HALKÖDE_MAKS_TAKSIT geçersiz, varsayılana dönüldü', { ham });
    return VARSAYILAN_MAKS_TAKSIT;
  }
  return n;
}

export const MAKS_TAKSIT = tavaniOku();

/** API'den gelen bir taksit seçeneği tavanın içinde mi? */
export function taksitGecerli(installmentsNumber: unknown): boolean {
  const n = Number(installmentsNumber) || 1;
  return Number.isFinite(n) && n >= 1 && n <= MAKS_TAKSIT;
}
