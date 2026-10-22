/**
 * ÖDEME ANINDA E-POSTA KUPONU KISITI (#994816) — tavan + kişi kilidi + tek kullanım.
 *
 * `discount-resolve.ts` Shopify kodunu çözüp tutarı hesapladıktan SONRA bu kancayı
 * çağırır. Kanca YALNIZ bizim ürettiğimiz kodlara dokunur (`EPOSTA_KOD_DESENI` +
 * defterde satırı olan); kampanya kodları için DB'ye bile gitmeden tutarı aynen
 * döndürür. Sebep ölçülmüş: tavanı Shopify yüzde dalının tamamına koymak %20
 * kampanya kodunu 5.000 TL sepette 1.000 TL'den 300 TL'ye kırpardı
 * (tests/eposta-kupon-tavan-siniri.test.ts).
 *
 * Kurallar (`cozumle` — tek kaynak, burada yeniden yazılmadı):
 *  · tavan: indirim `indirimTutariKurus(hak eden tutar)`'ı AŞAMAZ (1.500 TL üstü 300 TL)
 *  · kişiye özel: e-posta VERİLDİYSE kodun sahibiyle eşleşmeli. Sepet önizlemesinde
 *    (validate) e-posta henüz bilinmeyebilir → tavan uygulanır, kilit ödeme anında.
 *    Ödeme uçlarının hepsi müşteri e-postasını geçiriyor.
 *  · tek kullanım + süre: defterdeki damga/bitiş (Shopify sayacı bizim akışımızı
 *    saymaz — discount-resolve'un 11 Ağu notu).
 */
import { bizimKodMu, cozumle, indirimTutariKurus, kuponSatirKosulu, sabitKupon } from './eposta-kupon';
import { epostaKuponlari } from '@/db/schema';

export type KuponSatiri = { id: string; email: string; bitisAni: Date; kullanildiAni: Date | null };
export type KuponOkuyucu = (kod: string, email?: string | null) => Promise<KuponSatiri | null>;

const varsayilanOkuyucu: KuponOkuyucu = async (kod, email) => {
  // Geç yükleme: discount-resolve'u içe aktaran her dosya DB istemcisini çekmesin.
  const [{ db }, { desc }] = await Promise.all([import('@/db/client'), import('drizzle-orm')]);
  const [k] = await db
    .select({
      id: epostaKuponlari.id,
      email: epostaKuponlari.email,
      bitisAni: epostaKuponlari.bitisAni,
      kullanildiAni: epostaKuponlari.kullanildiAni,
    })
    .from(epostaKuponlari)
    .where(kuponSatirKosulu(kod, email))
    .orderBy(desc(epostaKuponlari.createdAt))
    .limit(1);
  return k ?? null;
};

const RET: Record<string, string> = {
  baska_kisi: 'Bu indirim kodu size tanımlı değil.',
  kullanildi: 'Bu kuponu daha önce kullandınız.',
  suresi_gecti: 'Bu kuponun süresi dolmuş.',
  sepet_yok: 'Bu kupon sepetindeki ürünlerde geçerli değil.',
  birlesmez: 'Bu kupon başka indirimle birlikte kullanılamaz.',
  yok: 'Bu indirim kodu geçersiz.',
};

export async function epostaKuponuKisitla(
  girdi: { kod: string; email?: string | null; amountKurus: number; eligibleSubtotalKurus: number; simdi?: Date },
  oku: KuponOkuyucu = varsayilanOkuyucu,
): Promise<{ ok: true; amountKurus: number } | { ok: false; error: string }> {
  const kod = (girdi.kod ?? '').trim().toUpperCase();
  if (!bizimKodMu(kod)) return { ok: true, amountKurus: girdi.amountKurus };
  const email = (girdi.email ?? '').trim();
  // SABİT KOD (#994914): Shopify'da herkese açık tek kod. Defterde bu e-postanın satırı
  // varsa kurallar (kişi · tek kullanım · süre · tavan) SIKI uygulanır. Satır yoksa ya da
  // e-posta henüz bilinmiyorsa (sepet önizlemesi) kod başka kanaldan (ör. hoş geldin
  // formu) gelmiş olabilir: reddedilmez, yalnız 300 TL TAVANI uygulanır.
  const sabitMi = kod === sabitKupon();
  const yalnizTavan = () => ({ ok: true as const, amountKurus: Math.max(0, Math.min(girdi.amountKurus, indirimTutariKurus(girdi.eligibleSubtotalKurus))) });
  if (sabitMi && !email) return yalnizTavan();
  let satir: KuponSatiri | null;
  try {
    satir = await oku(kod, email || null);
  } catch (e) {
    // Fail-closed: bizim desenimizdeki kod doğrulanamadan tavansız GEÇMEZ.
    console.error('[eposta-kupon] defter okunamadı — kupon reddedildi', { kod, error: String(e) });
    return { ok: false, error: 'Kupon şu anda doğrulanamıyor, lütfen tekrar deneyin.' };
  }
  // Desene uyan ama defterde olmayan kod bizim değil (elle açılmış) — dokunma.
  if (!satir) return sabitMi ? yalnizTavan() : { ok: true, amountKurus: girdi.amountKurus };
  const r = cozumle(
    satir,
    { email: email || satir.email, sepetKurus: girdi.eligibleSubtotalKurus },
    girdi.simdi ?? new Date(),
  );
  if (!r.ok) return { ok: false, error: RET[r.sebep] ?? 'Bu indirim kodu geçersiz.' };
  return { ok: true, amountKurus: Math.max(0, Math.min(girdi.amountKurus, r.indirimKurus)) };
}
