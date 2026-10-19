/**
 * Ölü mektup yazıcısı (#994753 · R1).
 *
 * ⚠ BU İŞLEV ASLA FIRLATMAZ. Çağrıldığı yer bir hata yolunun İÇİDİR: burada
 * atılan bir istisna, zaten başarısız olan isteğin yanıt kodunu da bozar ve
 * Shopify'a yanlış sinyal gider. Yazamazsa yalnız log'a düşer.
 */
import { webhookOluMektup } from '@/db/schema/webhook-olu-mektup';

/**
 * ⚠ `@/db/client` ÜST DÜZEYDE İÇE ALINMAZ: o modül yüklenirken DATABASE_URL
 * yoksa FIRLATIR. Üstte alınsaydı bu dosyayı sadece içe alan bir çivi bile
 * canlı bağlantı kurmaya zorlanırdı (ölçüldü: `DATABASE_URL is not set`).
 * Bağlantı ancak gerçekten yazılacağı anda, tembel olarak çözülür.
 */
type YazarDb = { insert: (t: typeof webhookOluMektup) => { values: (v: Record<string, unknown>) => Promise<unknown> } };

/** Ham gövde tavanı: büyük sipariş yükleri tabloyu şişirmesin. */
export const HAM_GOVDE_TAVANI = 64_000;

export type OluMektupGirdi = {
  konu: string;
  webhookId?: string | null;
  shopDomain?: string | null;
  /** true = kalıcı (şema/doğrulama), false = geçici (DB/ağ) */
  kalici: boolean;
  hata: string;
  hamGovde?: string | null;
};

/** Tavanı aşan gövde kırpılır ve kırpıldığı AÇIKÇA yazılır (sessiz kesme yok). */
export function govdeKirp(ham: string | null | undefined, tavan = HAM_GOVDE_TAVANI): string | null {
  if (ham == null) return null;
  if (ham.length <= tavan) return ham;
  return ham.slice(0, tavan) + `\n…[KIRPILDI: ${ham.length} bayt, tavan ${tavan}]`;
}

export async function oluMektupYaz(
  girdi: OluMektupGirdi,
  db?: YazarDb,
): Promise<boolean> {
  try {
    const hedef = db ?? ((await import('@/db/client')).db as unknown as YazarDb);
    await hedef.insert(webhookOluMektup).values({
      konu: girdi.konu,
      webhookId: girdi.webhookId ?? null,
      shopDomain: girdi.shopDomain ?? null,
      kalici: girdi.kalici,
      hata: girdi.hata.slice(0, 2000),
      hamGovde: govdeKirp(girdi.hamGovde),
    });
    return true;
  } catch (e) {
    // Tek kalan savunma log'dur: ölü mektup yazılamadıysa bunu GİZLEMEYİZ.
    console.error('[olu-mektup] YAZILAMADI', girdi.konu, girdi.webhookId, e);
    return false;
  }
}
