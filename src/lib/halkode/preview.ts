/**
 * Halköde gizli önizleme kapısı (sunucu tarafı okuma).
 *
 * NEDEN VAR: Ödeme ayarları DB'de TEK satır — Halköde'yi adminden açmak sitedeki
 * TÜM ziyaretçileri etkiler. Ayrı bir staging ortamı da yok. Yunus'un (iş ortağı)
 * akışı deneyebilmesi için yalnız ONA görünen bir yol gerekiyordu:
 *
 *   /odeme?halkode=1  → middleware çerezi kurar, parametresiz adrese yönlendirir
 *   /odeme?halkode=0  → çerez silinir
 *
 * KURALLAR:
 *  - Çerez YOKKEN hiçbir davranış değişmez; normal müşteri bugünkü akışı görür.
 *  - Önizleme HER ZAMAN test ortamına (testapp.halkode.com.tr) gider; bu yoldan
 *    canlı POS'a düşülmesi mümkün değildir (bkz. client.ts cfg()).
 *  - Çerez HttpOnly — istemci JS'i ile kurulamaz/okunamaz.
 */
import { cookies } from 'next/headers';
import { HALKODE_PREVIEW_COOKIE } from './preview-cookie';

/**
 * İstek bağlamında önizleme çerezi var mı?
 *
 * İstek DIŞINDA çağrılırsa (betikler, build zamanı, cron) `cookies()` fırlatır —
 * o durumda sessizce `false` döneriz: önizleme yalnız gerçek bir isteğe aittir.
 */
export async function isHalkodePreview(): Promise<boolean> {
  try {
    const jar = await cookies();
    return jar.get(HALKODE_PREVIEW_COOKIE)?.value === '1';
  } catch {
    return false;
  }
}
