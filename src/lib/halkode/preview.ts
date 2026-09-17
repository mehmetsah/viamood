/**
 * Halköde gizli önizleme kapısı (sunucu tarafı okuma).
 *
 * NEDEN VAR: Ödeme ayarları DB'de TEK satır — Halköde'yi adminden açmak sitedeki
 * TÜM ziyaretçileri etkiler. Ayrı bir staging ortamı da yok. Yunus'un (iş ortağı)
 * akışı deneyebilmesi için yalnız ONA görünen bir yol gerekiyordu:
 *
 *   /odeme?halkode=1                → middleware TEST çerezini kurar
 *   /odeme?halkode=0                → çerez silinir
 *   /odeme/halkode-test/<anahtar>   → TEST çerezi
 *   /odeme/halkode-canli/<anahtar>  → CANLI çerezi (gerçek para)
 *
 * KURALLAR:
 *  - Çerez YOKKEN hiçbir davranış değişmez; normal müşteri bugünkü akışı görür.
 *  - `?halkode=1` kapısı HER ZAMAN test ortamını açar — canlıya yalnız kendi
 *    ayrı anahtarı olan canlı sayfadan girilir (bkz. client.ts cfg()).
 *  - Çerez HttpOnly — istemci JS'i ile kurulamaz/okunamaz.
 */
import { cookies } from 'next/headers';
import { HALKODE_PREVIEW_COOKIE, cerezOrtami, type HalkodeOrtam } from './preview-cookie';

/**
 * İstek bağlamındaki önizleme ortamı ('test' | 'canli'), yoksa null.
 *
 * İstek DIŞINDA çağrılırsa (betikler, build zamanı, cron) `cookies()` fırlatır —
 * o durumda sessizce null döneriz: önizleme yalnız gerçek bir isteğe aittir.
 */
export async function halkodeOnizlemeOrtami(): Promise<HalkodeOrtam | null> {
  try {
    const jar = await cookies();
    return cerezOrtami(jar.get(HALKODE_PREVIEW_COOKIE)?.value);
  } catch {
    return null;
  }
}

/** Herhangi bir önizleme açık mı? (ortam ayrımı gerekmeyen çağıranlar için) */
export async function isHalkodePreview(): Promise<boolean> {
  return (await halkodeOnizlemeOrtami()) !== null;
}
