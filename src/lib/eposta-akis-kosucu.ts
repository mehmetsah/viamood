/**
 * OTOMATİK E-POSTA AKIŞI — KOŞUCU KATMANI (#992966 madde 3 · Faz 1 devamı)
 *
 * `eposta-akis.ts` KARAR verir ("hangi adım ne zaman, hangi kanaldan"), bu dosya
 * o kararı DEFTERE çevirir: tetik açılır, adımlar planlanır, vakti gelen satırlar
 * okunur, sonuç işaretlenir.
 *
 * ⚠ NEDEN AYRI DOSYA: `eposta-akis.ts` kendi başlığında "DB'ye de kuyruğa da
 * dokunmaz, yalnız KARAR verir" diyor. O saflık, zamanlama kurallarının gerçek
 * bir veritabanı olmadan sınanabilmesini sağlıyor; kirletmek yerine üstüne
 * ince bir katman kondu.
 *
 * ⛔ BU KATMAN MAİL GÖNDERMEZ. Gönderim kararı DÖRT açık soruya bağlı ve hiçbiri
 *    teknik değil — uydurulamaz:
 *      (1) tetiği KİM yazacak (sepet terki / sipariş / üyelik),
 *      (2) zamanlayıcı BullMQ gecikmeli iş mi yoklama mı,
 *      (3) her adımın METNİ (şablon) — ticari dil kararı,
 *      (4) SMS sağlayıcısı (yapılandırılmış sağlayıcı YOK; `kanalSec` 'sms'
 *          dönerse o dal sessizce düşer).
 *    Bu yüzden burada yalnız HER KARARIN ORTAK olarak ihtiyaç duyacağı mekanik
 *    katman var. Kararlar gelince üstüne gönderim bağlanır, bu dosya değişmez.
 *
 * ⛔ ÇİFT MAİL FRENİ KODDA DEĞİL ŞEMADA: `unique(tetik_id, adim)`. Buradaki
 *    `planSatirlari` aynı adımı iki kez üretmez ama asıl güvence veritabanında —
 *    kuyruk iki kez çalışsa bile ikinci INSERT düşer (şema başlığının kendi sözü:
 *    "KUYRUK DEĞİL, DEFTERDİR").
 */
import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import { AKIS, type Akis, akisPlani, kanalSec } from './eposta-akis';
import { epostaAkisGonderimleri, epostaAkisTetikleri } from '@/db/schema';

/** Şemadaki `durum` sözlüğü — serbest metin yazılmasın diye tek kaynak. */
export const DURUM = {
  PLANLANDI: 'planlandi',
  GONDERILDI: 'gonderildi',
  ATLANDI: 'atlandi',
  IPTAL: 'iptal',
  HATA: 'hata',
} as const;
export type Durum = (typeof DURUM)[keyof typeof DURUM];

export interface PlanSatiri {
  adim: number;
  planlananAn: Date;
  durum: Durum;
  kanal: 'eposta' | 'sms';
  kupon: boolean;
}

/**
 * SAF — bir tetiğin tüm adımlarını deftere yazılacak satırlara çevirir.
 * Kanal burada SABİTLENİR: İYS onayı tetik ANINDAKİ görüntüdür (şema notu),
 * sonradan değişse bile planlanmış satırın kanalı değişmez — yoksa "gönderim
 * anında hangi izin geçerliydi" sorusu cevapsız kalır.
 */
export function planSatirlari(tetik: { akis: Akis; tetikAni: Date; iysOnayi: boolean }): PlanSatiri[] {
  return akisPlani(tetik.akis, tetik.tetikAni).map((a) => ({
    adim: a.adim,
    planlananAn: a.planlananAn,
    durum: DURUM.PLANLANDI,
    kanal: kanalSec(a.sms, tetik.iysOnayi),
    kupon: a.kupon,
  }));
}

/** SAF — bu satırın vakti geldi mi? Sınır DAHİL (planlanan an == şimdi ⇒ gelir). */
export function vaktiGeldiMi(satir: { durum: string; planlananAn: Date }, simdi: Date): boolean {
  return satir.durum === DURUM.PLANLANDI && satir.planlananAn.getTime() <= simdi.getTime();
}

/**
 * SAF — akış erken kapanınca hangi satırlar iptale düşer?
 * YALNIZ 'planlandi' olanlar. Gönderilmiş adım geri alınamaz; onu 'iptal'
 * yapmak defteri yalan söyletirdi (mail gitti ama kayıt iptal görünürdü).
 */
export function iptalEdilecekler<T extends { id: string; durum: string }>(satirlar: T[]): T[] {
  return satirlar.filter((s) => s.durum === DURUM.PLANLANDI);
}

/** Drizzle'ın bu dosyada kullandığı dar yüzey — çivi sahte nesneyle koşabilsin. */
type DbGibi = {
  transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
  select: (...a: any[]) => any;
  update: (...a: any[]) => any;
};

/** Tetiği açar ve TÜM adımlarını tek işlemde planlar (yarım plan kalmaz). */
export async function akisBaslat(
  db: DbGibi,
  girdi: { akis: Akis; email: string; cartId?: string | null; iysOnayi?: boolean; tetikAni?: Date },
): Promise<{ tetikId: string; satir: number }> {
  const tetikAni = girdi.tetikAni ?? new Date();
  const iysOnayi = girdi.iysOnayi ?? false;
  return db.transaction(async (tx: any) => {
    const [tetik] = await tx
      .insert(epostaAkisTetikleri)
      .values({ akis: girdi.akis, email: girdi.email, cartId: girdi.cartId ?? null, iysOnayi, tetikAni })
      .returning({ id: epostaAkisTetikleri.id });
    const satirlar = planSatirlari({ akis: girdi.akis, tetikAni, iysOnayi });
    if (satirlar.length) {
      await tx.insert(epostaAkisGonderimleri).values(
        satirlar.map((s) => ({
          tetikId: tetik.id,
          adim: s.adim,
          planlananAn: s.planlananAn,
          durum: s.durum,
          kanal: s.kanal,
        })),
      );
    }
    return { tetikId: tetik.id, satir: satirlar.length };
  });
}

/**
 * Vakti gelmiş planlı satırlar. Şemanın kendi notu: `(durum, planlanan_an)`
 * "zamanlayıcının taradığı TEK indeks" — sorgu bilerek o indekse oturuyor.
 */
export async function bekleyenler(db: DbGibi, simdi: Date = new Date(), limit = 100) {
  return db
    .select({
      id: epostaAkisGonderimleri.id,
      tetikId: epostaAkisGonderimleri.tetikId,
      adim: epostaAkisGonderimleri.adim,
      planlananAn: epostaAkisGonderimleri.planlananAn,
      kanal: epostaAkisGonderimleri.kanal,
    })
    .from(epostaAkisGonderimleri)
    .where(and(eq(epostaAkisGonderimleri.durum, DURUM.PLANLANDI), lte(epostaAkisGonderimleri.planlananAn, simdi)))
    .orderBy(asc(epostaAkisGonderimleri.planlananAn))
    .limit(limit);
}

/** Sonucu işaretler. 'gonderildi' ise gönderim anı damgalanır. */
export async function gonderimIsaretle(
  db: DbGibi,
  id: string,
  durum: Exclude<Durum, 'planlandi'>,
  ek?: { hataMetni?: string; kuponId?: string },
) {
  return db
    .update(epostaAkisGonderimleri)
    .set({
      durum,
      gonderimAni: durum === DURUM.GONDERILDI ? new Date() : null,
      hataMetni: ek?.hataMetni ?? null,
      ...(ek?.kuponId ? { kuponId: ek.kuponId } : {}),
    })
    .where(eq(epostaAkisGonderimleri.id, id));
}

/**
 * Akışı erken kapatır (sipariş verdi / abonelikten çıktı / elle).
 * Tetik satırı SİLİNMEZ — şema başlığının kuralı: "niçin susulduğu iz olarak kalır".
 */
export async function akisIptal(db: DbGibi, tetikId: string, sebep: 'donusum' | 'abonelik_iptal' | 'elle') {
  return db.transaction(async (tx: any) => {
    await tx
      .update(epostaAkisTetikleri)
      .set({ iptalSebebi: sebep, iptalAni: new Date() })
      .where(eq(epostaAkisTetikleri.id, tetikId));
    await tx
      .update(epostaAkisGonderimleri)
      .set({ durum: DURUM.IPTAL })
      .where(and(eq(epostaAkisGonderimleri.tetikId, tetikId), inArray(epostaAkisGonderimleri.durum, [DURUM.PLANLANDI])));
  });
}

export { AKIS };
