/**
 * E-POSTA AKIŞI KUPONLARI — üretim · fren · çözümleme · kullanım damgası (#994057).
 *
 * `eposta-akis.ts` KARAR verir (yüzde, tavan, 60 gün freni, ömür), bu dosya o kararı
 * `eposta_kuponlari` defterine çevirir ve ödeme tarafının soracağı tek soruyu cevaplar:
 * "bu kod bu kişide, bu sepette geçerli mi ve kaç kuruş indirir?"
 *
 * ⚠ NEDEN KOD SHOPIFY'A YAZILMIYOR (ölçülmüş gerekçe, uydurulmadı):
 * Yunus'un spec'i "1.500 TL üstü siparişte indirim 300 TL'de TAVANLANSIN" diyor.
 * Shopify'ın yüzde indiriminde ÜST TAVAN alanı YOKTUR (yalnız Shopify Functions ile
 * yazılabilir, o da ayrı bir uygulama uzantısı demek). Buna karşılık bu platformda
 * ödeme uçlarının hepsi indirimi SUNUCUDA hesaplıyor
 * (`src/lib/shopify/discount-resolve.ts` → iyzico · halkode · paytr · cod · havale),
 * yani tavanı kendi tarafımızda GARANTİ edebiliyoruz. Kodu Shopify'da da açmak
 * tavanı aşan ikinci bir kullanım yolu doğurur — spec'i delen yol açılmadı.
 *
 * ⚠ BİRLEŞMEZ ("combinations"): e-posta kuponu kampanya indirimiyle ÜST ÜSTE BİNMEZ.
 * Karar burada tek satırda duruyor (`BIRLESIR = false`) ve `kuponCoz` başka indirim
 * bildirildiğinde kodu reddeder. Shopify'daki `combinesWith` ayarı bu kodlar için
 * ANLAMSIZDIR, çünkü kodlar Shopify'da yok.
 */
import { randomBytes } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  type Akis,
  TABAN_INDIRIM_YUZDE,
  UST_LIMIT_KURUS,
  indirimTutariKurus,
  kuponBitisi,
  kuponGecerliMi,
  kuponKoduUret,
  kuponVerilebilirMi,
} from './eposta-akis';
import { epostaKuponlari } from '@/db/schema';

/** E-posta kuponu başka indirimle birleşir mi? Spec: HAYIR. */
export const BIRLESIR = false;

/**
 * Tahmin edilemez gövde — `Math.random` DEĞİL (çekirdek dosyanın notu: tahmin
 * edilebilir kod, "tek kullanımlık" güvencesini anlamsız kılar).
 * Base32 benzeri alfabe: okunurken karışan 0/O ve 1/I/L çıkarıldı — kod müşteri
 * tarafından ELLE yazılıyor.
 */
const ALFABE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function govdeUret(uzunluk = 8, bayt: (n: number) => Buffer = randomBytes): string {
  const b = bayt(uzunluk);
  let s = '';
  for (let i = 0; i < uzunluk; i += 1) s += ALFABE.charAt((b[i] ?? 0) % ALFABE.length);
  return s;
}

type DbGibi = {
  select: (...a: any[]) => any;
  insert: (...a: any[]) => any;
  update: (...a: any[]) => any;
};

/** Bu e-postaya en son ne zaman kupon verildi? (60 gün freninin tek sorusu) */
export async function sonKuponAni(db: DbGibi, email: string): Promise<Date | null> {
  const [r] = await db
    .select({ createdAt: epostaKuponlari.createdAt })
    .from(epostaKuponlari)
    .where(eq(epostaKuponlari.email, email.trim().toLowerCase()))
    .orderBy(desc(epostaKuponlari.createdAt))
    .limit(1);
  return r?.createdAt ?? null;
}

export type KuponSonuc =
  | { ok: true; id: string; kod: string; bitisAni: Date; indirimYuzde: number; ustLimitKurus: number }
  | { ok: false; sebep: 'fren' | 'omur_yok' };

/**
 * Kişiye özel, TEK KULLANIMLIK kupon açar.
 * 60 gün freni KAPIDIR: fren açıksa satır YAZILMAZ ve `{ok:false,sebep:'fren'}` döner —
 * çağıran o adımı 'atlandi' işaretler, kuponsuz "indirim kodunuz" maili GÖNDERMEZ.
 */
export async function kuponAc(
  db: DbGibi,
  girdi: { email: string; akis: Akis; simdi?: Date; govde?: () => string },
): Promise<KuponSonuc> {
  const simdi = girdi.simdi ?? new Date();
  const email = girdi.email.trim().toLowerCase();
  if (!kuponVerilebilirMi(await sonKuponAni(db, email), simdi)) return { ok: false, sebep: 'fren' };
  const bitisAni = kuponBitisi(girdi.akis, simdi);
  if (!bitisAni) return { ok: false, sebep: 'omur_yok' };
  const kod = kuponKoduUret(girdi.akis, girdi.govde ?? (() => govdeUret()));
  const [r] = await db
    .insert(epostaKuponlari)
    .values({
      kod,
      email,
      akis: girdi.akis,
      indirimYuzde: TABAN_INDIRIM_YUZDE,
      ustLimitKurus: UST_LIMIT_KURUS,
      bitisAni,
    })
    .returning({ id: epostaKuponlari.id });
  return { ok: true, id: r.id, kod, bitisAni, indirimYuzde: TABAN_INDIRIM_YUZDE, ustLimitKurus: UST_LIMIT_KURUS };
}

export type CozumSonuc =
  | { ok: true; kuponId: string; indirimKurus: number; indirimYuzde: number }
  | { ok: false; sebep: 'yok' | 'baska_kisi' | 'suresi_gecti' | 'kullanildi' | 'birlesmez' | 'sepet_yok' };

/**
 * SAF — kuponun bu sepette kaç kuruş indirdiği. Tavan BURADA uygulanır
 * (`indirimTutariKurus`), yüzde düşmez; çıkan TUTAR tavana vurur.
 */
export function cozumle(
  kupon: { id: string; email: string; bitisAni: Date; kullanildiAni: Date | null } | null | undefined,
  istek: { email?: string | null; sepetKurus: number; baskaIndirimVar?: boolean },
  simdi: Date = new Date(),
): CozumSonuc {
  if (!kupon) return { ok: false, sebep: 'yok' };
  const isteyen = (istek.email ?? '').trim().toLowerCase();
  // KİŞİYE ÖZEL: kod başkasının adresiyle kullanılamaz. Adres hiç verilmediyse de
  // geçmez — "e-posta yok" hâli, kodu herkese açık hâle getirirdi.
  if (!isteyen || isteyen !== kupon.email.trim().toLowerCase()) return { ok: false, sebep: 'baska_kisi' };
  if (kupon.kullanildiAni) return { ok: false, sebep: 'kullanildi' };
  if (kupon.bitisAni.getTime() <= simdi.getTime()) return { ok: false, sebep: 'suresi_gecti' };
  if (istek.baskaIndirimVar && !BIRLESIR) return { ok: false, sebep: 'birlesmez' };
  if (!Number.isFinite(istek.sepetKurus) || istek.sepetKurus <= 0) return { ok: false, sebep: 'sepet_yok' };
  return { ok: true, kuponId: kupon.id, indirimKurus: indirimTutariKurus(istek.sepetKurus), indirimYuzde: TABAN_INDIRIM_YUZDE };
}

/** Koda göre kuponu okur (defterden) ve `cozumle` ile hükmünü verir. */
export async function kuponCoz(
  db: DbGibi,
  kod: string,
  istek: { email?: string | null; sepetKurus: number; baskaIndirimVar?: boolean },
  simdi: Date = new Date(),
): Promise<CozumSonuc> {
  const [k] = await db
    .select({
      id: epostaKuponlari.id,
      email: epostaKuponlari.email,
      bitisAni: epostaKuponlari.bitisAni,
      kullanildiAni: epostaKuponlari.kullanildiAni,
    })
    .from(epostaKuponlari)
    .where(eq(epostaKuponlari.kod, kod.trim().toUpperCase()))
    .limit(1);
  return cozumle(k ?? null, istek, simdi);
}

/**
 * TEK KULLANIM KİLİDİ — kuponu sipariş üstüne damgalar.
 * ⚠ Kilit kodda DEĞİL SORGUDA: `WHERE kullanildi_ani IS NULL`. İki ödeme isteği
 * aynı anda gelse bile ikinci UPDATE 0 satır etkiler ve `false` döner; uygulama
 * katmanında "önce oku sonra yaz" yarışı bırakılmadı.
 */
export async function kuponKullan(
  db: DbGibi,
  kuponId: string,
  siparisId?: string | null,
  simdi: Date = new Date(),
): Promise<boolean> {
  const r = await db
    .update(epostaKuponlari)
    .set({ kullanildiAni: simdi, kullanilanSiparisId: siparisId ?? null })
    .where(and(eq(epostaKuponlari.id, kuponId), isNull(epostaKuponlari.kullanildiAni)))
    .returning({ id: epostaKuponlari.id });
  return Array.isArray(r) ? r.length === 1 : false;
}

export { kuponGecerliMi, indirimTutariKurus };
