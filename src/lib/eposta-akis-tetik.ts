/**
 * OTOMATİK E-POSTA AKIŞI — TETİKLEYİCİLER (#994057).
 *
 * "Tetiği KİM yazacak" sorusu koşucu dosyasının kendi başlığında AÇIK soru olarak
 * bırakılmıştı; bu dosya onu cevaplıyor:
 *   · HOŞ GELDİN  → üyelik/pop-up kaydı açılınca (çağrı: welcome-signup akışı)
 *   · SEPET TERKİ → `carts.status='active'` ve sepet 1 saattir dokunulmamışsa
 *   · CHECKOUT TERKİ → aynı sepette ÖDEME ADIMI alanları doldurulmuşsa
 *
 * ⚠ SEPET Mİ CHECKOUT MU — ölçülebilir ayrım, tahmin değil: `carts.attributes`
 * içinde checkout alanları (adres/telefon/ödeme yöntemi) doldurulmuşsa müşteri
 * ödeme adımına GİRMİŞTİR ⇒ checkout terki (1sa/24sa). Hiçbiri yoksa sepet terki
 * (1sa/24sa/48sa). İki akış aynı sepete AYNI ANDA açılmaz — iki ayrı posta dizisi
 * aynı kişiye üst üste binerdi.
 *
 * ⚠ E-POSTASIZ SEPET ATLANIR (sessiz değil, sayılır): adres yoksa gönderilecek
 * yer yoktur; satır 'abandoned' işaretlenir ama akış AÇILMAZ.
 */
import { and, eq, lte, or, sql } from 'drizzle-orm';
import { AKIS } from './eposta-akis';
import { akisBaslat, akisIptal } from './eposta-akis-kosucu';
import { carts, customers, epostaAkisTetikleri } from '@/db/schema';

const SAAT = 3600_000;
/** Sepete/ödemeye dokunulmadan geçmesi gereken süre — terk sayılma eşiği. */
export const TERK_ESIGI_MS = 1 * SAAT;

/** Checkout adımına girildiğini gösteren alanlar (cart attributes anahtarları). */
export const CHECKOUT_ALANLARI = ['address1', 'payment_method', 'phone', 'il', 'ilce'] as const;

type Nitelikler = Record<string, string> | null | undefined;

/** SAF — sepetin e-posta adresi (attributes içinde; birkaç ad denenir). */
export function epostaCikar(a: Nitelikler): string | null {
  for (const k of ['email', 'e_posta', 'customer_email', 'eposta']) {
    const v = (a?.[k] ?? '').trim();
    if (v.includes('@')) return v.toLowerCase();
  }
  return null;
}

/** SAF — bu sepet checkout terki mi, sepet terki mi? */
export function terkSinifi(a: Nitelikler): typeof AKIS.SEPET_TERKI | typeof AKIS.CHECKOUT_TERKI {
  const doldurulmus = CHECKOUT_ALANLARI.some((k) => ((a?.[k] ?? '').trim().length > 0));
  return doldurulmus ? AKIS.CHECKOUT_TERKI : AKIS.SEPET_TERKI;
}

type DbGibi = {
  transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
  select: (...a: any[]) => any;
  insert: (...a: any[]) => any;
  update: (...a: any[]) => any;
};

/** HOŞ GELDİN akışını açar. Aynı adrese ikinci kez açılmaz (tek seferlik). */
export async function hosGeldinTetikle(
  db: DbGibi,
  girdi: { email: string; iysOnayi?: boolean; simdi?: Date },
): Promise<{ acildi: boolean; tetikId?: string; sebep?: 'zaten_var' }> {
  const email = girdi.email.trim().toLowerCase();
  const [v] = await db
    .select({ id: epostaAkisTetikleri.id })
    .from(epostaAkisTetikleri)
    .where(and(eq(epostaAkisTetikleri.akis, AKIS.HOS_GELDIN), eq(epostaAkisTetikleri.email, email)))
    .limit(1);
  if (v) return { acildi: false, sebep: 'zaten_var' };
  const r = await akisBaslat(db, {
    akis: AKIS.HOS_GELDIN,
    email,
    iysOnayi: girdi.iysOnayi ?? false,
    tetikAni: girdi.simdi ?? new Date(),
  });
  return { acildi: true, tetikId: r.tetikId };
}

export interface TerkOzet {
  tarandi: number;
  acilan: number;
  epostasiz: number;
  sinif: Record<string, number>;
}

/**
 * TERK TARAYICI: eşiği geçmiş aktif sepetleri 'abandoned' işaretler ve akışı açar.
 * ⚠ İŞARET KALICI, AKIŞ İKİNCİ KEZ AÇILMAZ (md.23-i idempotans): sepet bir kez
 * 'abandoned' olduğunda bir sonraki tur onu TARAMAZ, çünkü sorgu yalnız 'active'
 * satırlara bakar. Bellekte fren tutulmadı — süreç yeniden başlayınca sıfırlanırdı.
 */
export async function terkTara(
  db: DbGibi,
  secenek: { simdi?: Date; esikMs?: number; limit?: number } = {},
): Promise<TerkOzet> {
  const simdi = secenek.simdi ?? new Date();
  const esik = new Date(simdi.getTime() - (secenek.esikMs ?? TERK_ESIGI_MS));
  const satirlar = await db
    .select({ id: carts.id, token: carts.token, attributes: carts.attributes, customerId: carts.customerId })
    .from(carts)
    .where(and(eq(carts.status, 'active'), lte(carts.updatedAt, esik)))
    .limit(secenek.limit ?? 100);

  const ozet: TerkOzet = { tarandi: satirlar.length, acilan: 0, epostasiz: 0, sinif: {} };
  for (const c of satirlar) {
    let email = epostaCikar(c.attributes as Nitelikler);
    // ÜYE EŞLEŞTİRMESİ (Yunus 16 Eki: «giriş yaptıysa zaten kayıtlı maile»).
    // Sepet niteliklerinde e-posta yoksa ve sepet bir ÜYEYE bağlıysa, müşteri
    // kaydındaki e-posta kullanılır. Tema/vitrin değişikliği GEREKMEZ — bağ
    // zaten `carts.customer_id` sütununda duruyor.
    // ⚠ ANONİM ziyaretçi bu yoldan FAYDALANMAZ (kapsam dışı, Yunus'un kararı).
    if (!email && c.customerId) {
      const [m] = await db
        .select({ email: customers.email })
        .from(customers)
        .where(or(eq(customers.shopifyCustomerId, c.customerId), sql`${customers.id}::text = ${c.customerId}`))
        .limit(1);
      if (m?.email) email = m.email.trim().toLowerCase();
    }
    await db.update(carts).set({ status: 'abandoned' }).where(eq(carts.id, c.id));
    if (!email) { ozet.epostasiz += 1; continue; }
    const akis = terkSinifi(c.attributes as Nitelikler);
    await akisBaslat(db, { akis, email, cartId: c.id, tetikAni: simdi });
    ozet.acilan += 1;
    ozet.sinif[akis] = (ozet.sinif[akis] ?? 0) + 1;
  }
  return ozet;
}

/**
 * DÖNÜŞÜM FRENİ: kişi sipariş verdiyse açık akışları kapatır — "sepetinizi
 * tamamlayın" maili sipariş verdikten SONRA gitmez.
 */
export async function donusumIptal(db: DbGibi, email: string): Promise<number> {
  const acik = await db
    .select({ id: epostaAkisTetikleri.id })
    .from(epostaAkisTetikleri)
    .where(and(eq(epostaAkisTetikleri.email, email.trim().toLowerCase()), sql`${epostaAkisTetikleri.iptalSebebi} is null`));
  for (const t of acik) await akisIptal(db, t.id, 'donusum');
  return acik.length;
}
