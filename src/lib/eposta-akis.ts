/**
 * OTOMATİK E-POSTA AKIŞLARI — ÇEKİRDEK MANTIK (#991676, Faz 1).
 *
 * Yunus / reklam firması talebi (27 Eyl 2026). Bu dosya BİLEREK saf tutuldu:
 * DB'ye de kuyruğa da dokunmaz, yalnız KARAR verir. Böylece zamanlama, kupon
 * ve fren kuralları tek yerde ve testlenebilir durur; çağıran katman onları
 * yeniden yazmaz (iki kopya olursa biri güncellenmeyince sessizce ayrışır —
 * bu depoda ölçülmüş bir arıza sınıfı).
 *
 * ⛔ ŞABLON METNİ VE GÖRSEL BU DOSYADA YOK — Ayşe onayına kalıyor.
 */

/** Üç akış. Değerler DB'ye yazılır; değiştirilirse göç gerekir. */
export const AKIS = { HOS_GELDIN: 'hos_geldin', SEPET_TERKI: 'sepet_terki', CHECKOUT_TERKI: 'checkout_terki' } as const;
export type Akis = (typeof AKIS)[keyof typeof AKIS];

const SAAT = 3600_000;
const GUN = 24 * SAAT;

/**
 * Her akışın adımları — gecikme, kupon var mı, kanal.
 * ⚠ SMS yalnız İYS onayı VARSA; bu tabloda `sms: true` olan adım, onay yoksa
 * e-postaya düşer (karar `kanalSec`de, tek yerde).
 */
export const ADIMLAR: Record<Akis, Array<{ adim: number; gecikmeMs: number; kupon: boolean; sms: boolean }>> = {
  [AKIS.HOS_GELDIN]: [
    { adim: 1, gecikmeMs: 0, kupon: true, sms: false },      // anında: kod teslimi
    { adim: 2, gecikmeMs: 2 * GUN, kupon: false, sms: false }, // +2 gün: hatırlatma
  ],
  [AKIS.SEPET_TERKI]: [
    { adim: 1, gecikmeMs: 1 * SAAT, kupon: false, sms: false }, // indirimsiz
    { adim: 2, gecikmeMs: 24 * SAAT, kupon: true, sms: false },  // %10
    { adim: 3, gecikmeMs: 48 * SAAT, kupon: false, sms: true },  // son hatırlatma (İYS varsa SMS)
  ],
  [AKIS.CHECKOUT_TERKI]: [
    { adim: 1, gecikmeMs: 1 * SAAT, kupon: false, sms: false }, // güven vurgulu, indirimsiz
    { adim: 2, gecikmeMs: 24 * SAAT, kupon: true, sms: false },  // %10
  ],
};

/** Kupon geçerlilik süreleri — akışa göre. */
export const KUPON_OMRU_MS: Partial<Record<Akis, number>> = {
  [AKIS.HOS_GELDIN]: 7 * GUN,
  [AKIS.SEPET_TERKI]: 48 * SAAT,
  [AKIS.CHECKOUT_TERKI]: 48 * SAAT,
};

export const TABAN_INDIRIM_YUZDE = 10;
/** Üst limitin devreye girdiği sepet tutarı (kuruş) ve limit (kuruş). */
export const UST_LIMIT_ESIGI_KURUS = 150_000;   // 1.500 TL
export const UST_LIMIT_KURUS = 30_000;          // 300 TL
/** Aynı kişiye tekrar kupon verilmeden önce geçmesi gereken süre. */
export const FREN_GUN = 60;
export const FREN_MS = FREN_GUN * GUN;

/** Bir adımın ne zaman gönderileceği. Tetik anına gecikme eklenir. */
export function planlananAn(akis: Akis, adim: number, tetikAni: Date): Date | null {
  const a = ADIMLAR[akis]?.find((x) => x.adim === adim);
  if (!a) return null;
  return new Date(tetikAni.getTime() + a.gecikmeMs);
}

/** Akışın tüm adımlarının planı — kuyruğa tek seferde yazmak için. */
export function akisPlani(akis: Akis, tetikAni: Date): Array<{ adim: number; planlananAn: Date; kupon: boolean; sms: boolean }> {
  return (ADIMLAR[akis] ?? []).map((a) => ({
    adim: a.adim,
    planlananAn: new Date(tetikAni.getTime() + a.gecikmeMs),
    kupon: a.kupon,
    sms: a.sms,
  }));
}

/**
 * İndirim tutarı (kuruş). Taban %10; sepet eşiği aşarsa ÜST LİMİT uygulanır.
 *
 * ⚠ Üst limit "indirim yüzdesi düşsün" demek DEĞİL — yüzde aynı kalır, çıkan
 * TUTAR tavana vurur. 1.500 TL'de %10 = 150 TL (limit altı, aynen geçer);
 * 5.000 TL'de %10 = 500 TL ama tavan 300 TL. Yanlış okuma müşteriye fazla
 * indirim yazdırırdı.
 */
export function indirimTutariKurus(sepetKurus: number): number {
  if (!Number.isFinite(sepetKurus) || sepetKurus <= 0) return 0;
  const ham = Math.floor((sepetKurus * TABAN_INDIRIM_YUZDE) / 100);
  if (sepetKurus > UST_LIMIT_ESIGI_KURUS) return Math.min(ham, UST_LIMIT_KURUS);
  return ham;
}

/**
 * 60 GÜN FRENİ — indirim avcılığını önler.
 * `sonKuponAni` bu e-postaya en son kupon verildiği an (yoksa null).
 */
export function kuponVerilebilirMi(sonKuponAni: Date | null | undefined, simdi: Date = new Date()): boolean {
  if (!sonKuponAni) return true;
  return simdi.getTime() - sonKuponAni.getTime() >= FREN_MS;
}

/**
 * Kanal seçimi — SMS YALNIZ İYS onayı varsa.
 * Onay yoksa adım atlanmaz, e-postaya düşer: müşteri bilgisiz kalmasın ama
 * izinsiz SMS de gitmesin.
 */
export function kanalSec(adimSms: boolean, iysOnayi: boolean): 'eposta' | 'sms' {
  return adimSms && iysOnayi ? 'sms' : 'eposta';
}

/**
 * Kişiye özel, TEK KULLANIMLIK kupon kodu.
 * `Math.random` KULLANILMAZ — tahmin edilebilir kod, kuponun tek kullanımlık
 * olmasını anlamsız kılar (saldırgan başkasınınkini üretir).
 */
export function kuponKoduUret(akis: Akis, rastgele: () => string): string {
  const onek = akis === AKIS.HOS_GELDIN ? 'HG' : akis === AKIS.SEPET_TERKI ? 'ST' : 'CT';
  return `${onek}-${rastgele().toUpperCase()}`;
}

/** Kuponun geçerlilik bitişi. */
export function kuponBitisi(akis: Akis, uretimAni: Date): Date | null {
  const omur = KUPON_OMRU_MS[akis];
  return omur ? new Date(uretimAni.getTime() + omur) : null;
}

/** Kupon bugün kullanılabilir mi? (süre + tek kullanım) */
export function kuponGecerliMi(
  k: { bitisAni: Date; kullanildiAni: Date | null } | null | undefined,
  simdi: Date = new Date(),
): boolean {
  if (!k) return false;
  if (k.kullanildiAni) return false;
  return k.bitisAni.getTime() > simdi.getTime();
}
