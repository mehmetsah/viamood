/**
 * Taksit kuralları — TEK YAPILANDIRMA KAYNAĞI (tavan + alt sınır).
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
 * Liste yine API'den gelir; üstüne üç süzgeç uygulanır:
 *   (a) ödenecek tutar sepet tutarına EŞİT (vade farksız — TEMADA, bkz. not),
 *   (b) taksit sayısı <= MAKS_TAKSIT,
 *   (c) ödenecek tutar >= TAKSIT_ALT_SINIR_TL (altında yalnız tek çekim).
 * Süzgeç listeyi yalnız DARALTIR: API 2 veya 3'ü döndürmüyorsa onlar da gösterilmez,
 * olmayan taksit ÜRETİLMEZ.
 *
 * ⚠ (a) süzgeci BU DOSYADA DEĞİL — yalnız Shopify temasında yaşıyor
 * (via-checkout.liquid, `amount_to_be_paid*100 === amount`). Buradaki (b) ve (c) sunucu
 * tarafıdır ve otoritedir.
 *
 * ⚠ Bu modül İSTEMCİ bileşenlerinden de import edilir (CheckoutForm.tsx, DenemeFormu.tsx).
 * `process.env` tarayıcı paketinde yok, yani orada DAİMA varsayılanlar geçerlidir. Env ile
 * yapılan ayarın tek gerçek etkisi SUNUCU uçlarındadır (installments + initialize) —
 * listeyi zaten onlar süzdüğü için istemcinin varsayılanla çalışması ekranı bozmaz.
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

/**
 * Varsayılan alt sınır — 1.000 TL (Yunus, 22 Kas 2026).
 *
 * Kural: ödenecek SON tutar (sepet + kargo − indirim) 1.000 TL ve ÜZERİNDEYSE taksitler
 * gösterilir; altındaysa taksit hiç çıkmaz, yalnız tek çekim olur. Tavan gibi bu da bir
 * GÖSTERİM ve KABUL sınırıdır; vade farkı/komisyon tarafına dokunmaz.
 */
export const VARSAYILAN_TAKSIT_ALT_SINIR_TL = 1000;

function altSiniriOku(): number {
  const ham = process.env.HALKODE_TAKSIT_ALT_SINIR_TL;
  if (!ham) return VARSAYILAN_TAKSIT_ALT_SINIR_TL;
  const n = Number(ham);
  // 0 = sınır KAPALI. Bilinçli kapı: deneme sayfaları (halkode-test / halkode-canli)
  // 4,10 ve 10 TL ile çalışır, yani varsayılan sınırda taksit akışı HİÇ ölçülemez.
  // Taksit denemesi gerektiğinde .env.production'a 0 yazılır + pm2 restart (deploy'suz).
  // Negatif/bozuk değer sessizce sınırsıza açılmasın: varsayılana dön ve GÜRÜLTÜ ÇIKAR.
  if (!Number.isFinite(n) || n < 0) {
    console.warn('[halkode] HALKODE_TAKSIT_ALT_SINIR_TL geçersiz, varsayılana dönüldü', { ham });
    return VARSAYILAN_TAKSIT_ALT_SINIR_TL;
  }
  return n;
}

export const TAKSIT_ALT_SINIR_TL = altSiniriOku();

/**
 * Tutar taksite yetiyor mu? Tek çekim bu kapıdan GEÇMEZ — her tutarda serbesttir,
 * bu yüzden tek çekim kontrolü çağıranda değil `taksitSecilebilir` içinde yapılır.
 */
export function taksitTutariYeterli(tutarTl: unknown): boolean {
  const t = Number(tutarTl);
  return Number.isFinite(t) && t >= TAKSIT_ALT_SINIR_TL;
}

/**
 * TEK KAPI — tavan + alt sınır. İki sunucu ucu da bunu kullanır (installments listeler,
 * initialize kabul eder); kural tek yerde durur, uçlarda kopyalanmaz.
 *
 * Tek çekim (1) her tutarda geçerlidir: 1.000 TL altında müşteriyi ödemesiz bırakmıyoruz,
 * yalnız taksidi kapatıyoruz.
 */
export function taksitSecilebilir(installmentsNumber: unknown, tutarTl: unknown): boolean {
  const n = Number(installmentsNumber) || 1;
  if (!taksitGecerli(n)) return false; // tavan AYNEN korundu
  return n === 1 || taksitTutariYeterli(tutarTl);
}
