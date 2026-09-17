/**
 * Halköde "gizli önizleme" çerezinin ADI ve DEĞERLERİ — tek yerde tanımlı.
 *
 * Bu dosya BİLEREK bağımsız: middleware (edge runtime) bu sabitleri okur ve
 * `next/headers` içe aktaran preview.ts'yi import edemez.
 */
export const HALKODE_PREVIEW_COOKIE = 'vm_halkode_preview';

/**
 * Çerez DEĞERİ hangi Halköde ortamının açılacağını söyler:
 *   '1'     → TEST ortamı (testapp.halkode.com.tr) — gerçek para YOK
 *   'canli' → CANLI ortam (app.halkode.com.tr)     — GERÇEK PARA ÇEKİLİR
 *
 * '1' tarihsel değerdir ve korunur: daha önce kurulmuş çerezler geçerli kalsın,
 * kimse yarım kalmış bir oturumda sessizce canlıya düşmesin.
 */
export const HALKODE_ORTAM_TEST = '1';
export const HALKODE_ORTAM_CANLI = 'canli';

export type HalkodeOrtam = 'test' | 'canli';

/** Çerez değerini ortama çevirir. Tanınmayan değer → null (önizleme yok). */
export function cerezOrtami(deger: string | undefined): HalkodeOrtam | null {
  if (deger === HALKODE_ORTAM_TEST) return 'test';
  if (deger === HALKODE_ORTAM_CANLI) return 'canli';
  return null;
}

export function ortamCerezDegeri(ortam: HalkodeOrtam): string {
  return ortam === 'canli' ? HALKODE_ORTAM_CANLI : HALKODE_ORTAM_TEST;
}

/** Önizleme çerezinin ömrü (saniye) — kısa tutulur, kalıcı bir mod değildir. */
export const HALKODE_PREVIEW_MAX_AGE = 2 * 60 * 60;

/**
 * 10 TL TEST sayfasının adresindeki tahmin edilmesi zor anahtar.
 *
 * BURADA duruyor çünkü middleware (edge runtime) bunu okumak zorunda ve bu
 * dosya bilerek bağımsız — `next/headers` içe aktaran modülleri edge'e
 * sokamayız. test-page.ts bu sabiti buradan yeniden dışa verir.
 */
export const HALKODE_TEST_ANAHTAR = process.env.HALKODE_TEST_ANAHTAR || 'vm-3k9qx7';

/**
 * 10 TL CANLI sayfasının anahtarı — TEST anahtarından FARKLI kurallara tabi.
 *
 * ⚠️ VARSAYILANI YOK ve OLMAMALI. Test sayfasında koda gömülü bir varsayılan
 * zararsızdı: o yol mimari olarak canlı POS'a bağlanamıyordu, anahtar yalnız
 * "müşteri yanlışlıkla düşmesin" kapı tokmağıydı. Canlı sayfada durum tersine
 * döndü — bu anahtar GERÇEK PARA çeken tek kapının önündeki tek kilit. Koda
 * gömülseydi depoyu gören herkes kilide sahip olurdu.
 *
 * Bu yüzden değer YALNIZ ortamdan gelir; yoksa boş kalır ve canlı sayfa
 * kendini kapatır (404 / 403). "Anahtar tanımsız" durumu asla "herkese açık"
 * anlamına gelmez.
 */
export const HALKODE_CANLI_ANAHTAR = process.env.HALKODE_CANLI_ANAHTAR || '';
