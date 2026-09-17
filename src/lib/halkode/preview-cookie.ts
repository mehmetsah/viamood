/**
 * Halköde "gizli önizleme" çerezinin ADI — tek yerde tanımlı.
 *
 * Bu dosya BİLEREK bağımsız: middleware (edge runtime) bu sabiti okur ve
 * `next/headers` içe aktaran preview.ts'yi import edemez.
 */
export const HALKODE_PREVIEW_COOKIE = 'vm_halkode_preview';

/** Önizleme çerezinin ömrü (saniye) — kısa tutulur, kalıcı bir mod değildir. */
export const HALKODE_PREVIEW_MAX_AGE = 2 * 60 * 60;

/**
 * 10 TL test sayfasının adresindeki tahmin edilmesi zor anahtar.
 *
 * BURADA duruyor çünkü middleware (edge runtime) bunu okumak zorunda ve bu
 * dosya bilerek bağımsız — `next/headers` içe aktaran modülleri edge'e
 * sokamayız. test-page.ts bu sabiti buradan yeniden dışa verir.
 */
export const HALKODE_TEST_ANAHTAR = process.env.HALKODE_TEST_ANAHTAR || 'vm-3k9qx7';
