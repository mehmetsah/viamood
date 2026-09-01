/**
 * Mikro aktarım sonucunu Shopify siparişine iz olarak düşer.
 *
 * NEDEN: Shopify tarafında başarılı aktarımla başarısız aktarım birebir aynı görünüyordu —
 * hiçbir etiket, not veya işaret yoktu. Bunun somut bedeli 1 Eyl 2026 denetiminde çıktı:
 * #1124 aslında Mikro'ya geçmişken 4 gün "geçmemiş" sanılıp takip edildi, buna karşılık
 * gerçekten eksik olan #1119 (4.250 TL) kimsenin gözüne çarpmadı. Artık sipariş listesinde
 * `mikro-ok` / `mikro-hata` etiketiyle bakışta ayrılıyor.
 *
 * TASARIM KURALI: bu modül aktarımın kendisini ASLA etkilemez. Etiket yazımı başarısız
 * olursa sessizce loglanır; çağıran taraf hiçbir şey hissetmez (bkz. try/catch + void).
 */
import { shopifyRest } from './client';

const OK_TAG = 'mikro-ok';
const ERR_TAG = 'mikro-hata';

/** Aktarım etiketlerini ayıklar — durum değişince eskisi kalmasın (ok→hata, hata→ok). */
function digerEtiketler(mevcut: string | null | undefined): string[] {
  return (mevcut ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t && t !== OK_TAG && t !== ERR_TAG && !t.startsWith('mikro-S'));
}

async function etiketYaz(
  numericOrderId: string,
  yeniEtiketler: string[],
  not?: string,
): Promise<void> {
  const cur = await shopifyRest<{ order?: { tags?: string; note?: string } }>(
    `/orders/${numericOrderId}.json?fields=tags,note`,
  );
  const tags = [...digerEtiketler(cur.order?.tags), ...yeniEtiketler];

  const payload: Record<string, unknown> = { id: Number(numericOrderId), tags: tags.join(', ') };

  // Hata sebebini nota ekle — etiket kısa, sebep uzun. Mevcut notun ÜSTÜNE yazmaz,
  // kendi satırını günceller (not alanında sipariş/fatura bilgileri duruyor).
  if (not !== undefined) {
    const eski = (cur.order?.note ?? '')
      .split('\n')
      .filter((s) => !s.startsWith('[mikro]'))
      .join('\n')
      .trimEnd();
    payload.note = not ? `${eski}${eski ? '\n' : ''}[mikro] ${not}`.slice(0, 5000) : eski;
  }

  await shopifyRest(`/orders/${numericOrderId}.json`, {
    method: 'PUT',
    body: JSON.stringify({ order: payload }),
  });
}

/**
 * Başarılı aktarım izi: `mikro-ok` + `mikro-<evrakSeri>` (ör. `mikro-001S1124`).
 * Evrak serisi etikete girdiği için Mikro'da aramak için kopyala-yapıştır yeterli.
 */
export async function tagMikroBasarili(
  numericOrderId: string | null | undefined,
  evrakSeri: string | null | undefined,
): Promise<void> {
  if (!numericOrderId) return;
  try {
    const etiketler = [OK_TAG, ...(evrakSeri ? [`mikro-${evrakSeri}`] : [])];
    await etiketYaz(numericOrderId, etiketler, '');
  } catch (err) {
    // Aktarım başarılı; etiket kozmetik. Yutup logla — akışı bozma.
    console.error('[mikro-tag] basarili etiketi yazilamadi:', err);
  }
}

/** Başarısız aktarım izi: `mikro-hata` + nota kısa sebep. */
export async function tagMikroHatali(
  numericOrderId: string | null | undefined,
  sebep: string | null | undefined,
): Promise<void> {
  if (!numericOrderId) return;
  try {
    await etiketYaz(numericOrderId, [ERR_TAG], (sebep ?? 'bilinmeyen hata').slice(0, 200));
  } catch (err) {
    console.error('[mikro-tag] hata etiketi yazilamadi:', err);
  }
}
