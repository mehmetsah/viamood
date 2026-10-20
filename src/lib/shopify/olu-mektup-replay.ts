/**
 * Ölü mektup YENİDEN OYNATMA (#994753 · replay ayağı).
 *
 * ⚠ NEDEN VAR: `olu-mektup.ts` yalnız YAZMA tarafıydı — kutuya düşen her kayıt
 * orada kalıyordu. Bu deponun en sık arızası "yargıç var, ÇAĞIRAN yok"tur
 * (md.47/§1); bu dosya mantığı, `app/api/cron/webhook-replay` ucu çağıranı verir.
 *
 * KARAR TABLOSU — hangi kayıt oynatılır:
 *   kalici=true  (şema/doğrulama)  → ASLA otomatik oynatılmaz. Tekrar denemek
 *                                     aynı hatayı üretir; yalnız raporlanır.
 *   kalici=false (DB/ağ, geçici)   → oynatılır; üstel geri çekilmeyle.
 *   islendiTs dolu                 → kapanmış, dokunulmaz.
 *   elleInceleme=true              → tavan aşıldı, otomatiğe KAPALI (silinmez).
 *
 * ⚠ `@/db/client` BU DOSYADA DA ÜST DÜZEYDE İÇE ALINMAZ (olu-mektup.ts ile aynı
 * gerekçe: modül yüklenirken DATABASE_URL yoksa fırlatır). Çiviler sahte db ile koşar.
 */

/** Tavan: bu kadar denemeden sonra kayıt insana devredilir. */
export const DENEME_TAVANI = 5;
/** Üstel geri çekilmenin tabanı: 1. deneme sonrası 5 dk, sonra 10, 20, 40, 80 dk. */
export const GERI_CEKILME_TABAN_MS = 5 * 60_000;

export type OluMektupKaydi = {
  id: string;
  konu: string;
  webhookId: string | null;
  shopDomain: string | null;
  kalici: boolean;
  hata: string;
  hamGovde: string | null;
  islendiTs: Date | null;
  denemeSayisi: number;
  sonDenemeTs: Date | null;
  elleInceleme: boolean;
};

/** n. denemeden sonra beklenecek süre. n=0 ⇒ hiç denenmemiş, beklemeden denenir. */
export function geriCekilmeMs(denemeSayisi: number, taban = GERI_CEKILME_TABAN_MS): number {
  if (denemeSayisi <= 0) return 0;
  return taban * 2 ** (denemeSayisi - 1);
}

/** Tek kaydın şu an oynatılabilir olup olmadığı — SAF, yan etkisiz, çivilenebilir. */
export function replayEdilebilirMi(k: OluMektupKaydi, simdi: Date): { olur: boolean; sebep: string } {
  if (k.islendiTs) return { olur: false, sebep: 'zaten islendi' };
  if (k.elleInceleme) return { olur: false, sebep: 'elle inceleme' };
  if (k.kalici) return { olur: false, sebep: 'kalici hata — tekrar ayni sonucu verir' };
  if (!k.hamGovde) return { olur: false, sebep: 'ham govde yok — yeniden oynatilamaz' };
  if (k.denemeSayisi >= DENEME_TAVANI) return { olur: false, sebep: 'deneme tavani asildi' };
  if (k.sonDenemeTs) {
    const gecen = simdi.getTime() - k.sonDenemeTs.getTime();
    if (gecen < geriCekilmeMs(k.denemeSayisi)) return { olur: false, sebep: 'geri cekilme suresi dolmadi' };
  }
  return { olur: true, sebep: 'gecici hata, suresi doldu' };
}

export type IsleyiciSonuc = { ok: boolean; hata?: string; retryable?: boolean };
export type Isleyici = (konu: string, govde: unknown) => Promise<IsleyiciSonuc>;

export type ReplayDeposu = {
  acikKayitlar: (limit: number) => Promise<OluMektupKaydi[]>;
  /** Kayıt SİLİNMEZ; yalnız damgalanır (kalıcı veri silme yasağı). */
  damgala: (id: string, yama: { islendiTs?: Date; denemeSayisi?: number; sonDenemeTs?: Date; elleInceleme?: boolean; hata?: string }) => Promise<void>;
};

export type ReplayOzet = {
  bakilan: number;
  oynatilan: number;
  basarili: number;
  basarisiz: number;
  atlanan: number;
  elleIncelemeyeGecen: number;
  tekrarAtlanan: number;
  atlamaSebepleri: Record<string, number>;
};

/**
 * Kutuyu tarar ve uygun kayıtları yeniden oynatır.
 *
 * İDEMPOTANS: aynı `webhookId` bu turda BİR KEZ işlenir (Shopify yeniden gönderimi
 * zaten aynı id ile gelir; replay onu ikiye katlamamalı). webhookId'si olmayan kayıt
 * kendi id'siyle tekilleşir.
 */
export async function oluMektupReplay(
  depo: ReplayDeposu,
  isle: Isleyici,
  opts: { limit?: number; simdi?: Date } = {},
): Promise<ReplayOzet> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 200);
  const simdi = opts.simdi ?? new Date();
  const ozet: ReplayOzet = { bakilan: 0, oynatilan: 0, basarili: 0, basarisiz: 0, atlanan: 0, elleIncelemeyeGecen: 0, tekrarAtlanan: 0, atlamaSebepleri: {} };
  const gorulen = new Set<string>();

  const kayitlar = await depo.acikKayitlar(limit);
  ozet.bakilan = kayitlar.length;

  for (const k of kayitlar) {
    const karar = replayEdilebilirMi(k, simdi);
    if (!karar.olur) {
      ozet.atlanan++;
      ozet.atlamaSebepleri[karar.sebep] = (ozet.atlamaSebepleri[karar.sebep] ?? 0) + 1;
      continue;
    }
    const anahtar = k.webhookId ?? `id:${k.id}`;
    if (gorulen.has(anahtar)) { ozet.tekrarAtlanan++; continue; }
    gorulen.add(anahtar);

    let govde: unknown;
    try {
      govde = JSON.parse(k.hamGovde as string);
    } catch {
      // Gövde bozuk/kırpılmış ⇒ bu KALICI bir durumdur, otomatik deneme anlamsız.
      await depo.damgala(k.id, { elleInceleme: true, sonDenemeTs: simdi, hata: 'replay: ham govde JSON parse edilemedi (kirpilmis olabilir)' });
      ozet.elleIncelemeyeGecen++;
      continue;
    }

    ozet.oynatilan++;
    const yeniDeneme = k.denemeSayisi + 1;
    let sonuc: IsleyiciSonuc;
    try {
      sonuc = await isle(k.konu, govde);
    } catch (e) {
      sonuc = { ok: false, hata: e instanceof Error ? e.message : String(e), retryable: true };
    }

    if (sonuc.ok) {
      // Başarı: kayıt SİLİNMEZ, "işlendi" damgası alır.
      await depo.damgala(k.id, { islendiTs: simdi, denemeSayisi: yeniDeneme, sonDenemeTs: simdi });
      ozet.basarili++;
      continue;
    }

    ozet.basarisiz++;
    const kaliciOldu = sonuc.retryable === false;
    const tavanaDayandi = yeniDeneme >= DENEME_TAVANI;
    await depo.damgala(k.id, {
      denemeSayisi: yeniDeneme,
      sonDenemeTs: simdi,
      elleInceleme: kaliciOldu || tavanaDayandi,
      hata: `replay#${yeniDeneme}: ${sonuc.hata ?? 'bilinmeyen hata'}`,
    });
    if (kaliciOldu || tavanaDayandi) ozet.elleIncelemeyeGecen++;
  }
  return ozet;
}
