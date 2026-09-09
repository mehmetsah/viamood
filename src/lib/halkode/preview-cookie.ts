/**
 * Halköde "gizli önizleme" çerezinin ADI — tek yerde tanımlı.
 *
 * Bu dosya BİLEREK bağımsız: middleware (edge runtime) bu sabiti okur ve
 * `next/headers` içe aktaran preview.ts'yi import edemez.
 */
export const HALKODE_PREVIEW_COOKIE = 'vm_halkode_preview';

/** Önizleme çerezinin ömrü (saniye) — kısa tutulur, kalıcı bir mod değildir. */
export const HALKODE_PREVIEW_MAX_AGE = 2 * 60 * 60;
