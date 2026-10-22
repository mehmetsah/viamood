/**
 * E-POSTA AKIŞI KUPONLARI — üretim · fren · çözümleme · kullanım damgası (#994057).
 *
 * `eposta-akis.ts` KARAR verir (yüzde, tavan, 60 gün freni, ömür), bu dosya o kararı
 * `eposta_kuponlari` defterine çevirir ve ödeme tarafının soracağı tek soruyu cevaplar:
 * "bu kod bu kişide, bu sepette geçerli mi ve kaç kuruş indirir?"
 *
 * KOD İKİ YERDE YAŞAR (#994816):
 *   · `eposta_kuponlari` defteri — kişi, akış, bitiş, kullanım damgası (60 gün freni
 *     ve A2 "kullandıysa hatırlatma" kuralı BURADAN sorulur).
 *   · Shopify indirim kodu — ödeme uçları kodu `discount-resolve.ts` ile Shopify'dan
 *     çözer; orada olmayan kod müşteride "geçersiz" düşerdi. Açılış
 *     `src/lib/shopify/eposta-indirim.ts` (usageLimit 1 · combinations kapalı).
 *
 * TAVAN + KİŞİ KİLİDİ ödeme anında `eposta-kupon-odeme.ts` kancasıyla uygulanır:
 * Shopify yüzde indiriminde tavan alanı yoktur, ödeme uçları ise indirimi
 * SUNUCUDA hesaplar — tavan orada GARANTİ edilir, yalnız bu defterdeki kodlara.
 *
 * ⚠ BİRLEŞMEZ ("combinations"): Shopify'da `combinesWith` ürün/sipariş KAPALI;
 * kendi ödeme sayfamız zaten tek kod kabul ediyor (`BIRLESIR = false`).
 */
import { randomBytes } from 'node:crypto';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
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
import { FREN_AKISLARI, frenUygulanirMi } from './eposta-akis';
import type { ShopifyKuponAcici } from './shopify/eposta-indirim';

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

/**
 * Bu e-postaya en son ne zaman TERK İNDİRİMİ verildi? (60 gün freninin tek sorusu)
 * Yalnız `FREN_AKISLARI` sayılır — hoş geldin kodu freni YAKMAZ (spec: "sepet terki
 * indirimi").
 */
export async function sonKuponAni(db: DbGibi, email: string): Promise<Date | null> {
  const [r] = await db
    .select({ createdAt: epostaKuponlari.createdAt })
    .from(epostaKuponlari)
    .where(and(eq(epostaKuponlari.email, email.trim().toLowerCase()), inArray(epostaKuponlari.akis, [...FREN_AKISLARI])))
    .orderBy(desc(epostaKuponlari.createdAt))
    .limit(1);
  return r?.createdAt ?? null;
}

export type KuponSonuc =
  | { ok: true; id: string; kod: string; bitisAni: Date; indirimYuzde: number; ustLimitKurus: number }
  | { ok: false; sebep: 'fren' | 'omur_yok' | 'shopify'; hata?: string };

/**
 * Kişiye özel, TEK KULLANIMLIK kupon açar.
 * 60 gün freni KAPIDIR: fren açıksa satır YAZILMAZ ve `{ok:false,sebep:'fren'}` döner —
 * çağıran o adımı 'atlandi' işaretler, kuponsuz "indirim kodunuz" maili GÖNDERMEZ.
 */
/**
 * Bu kişinin BU AKIŞTAKİ kuponu kullanıldı mı? (#994057 A2 kuralı için)
 * Kupon hiç verilmemişse `false` döner — "kullanmadı" ile "kuponu yok" aynı
 * sonucu verir, ikisinde de hatırlatma gitmeli.
 */
export async function kuponKullanildiMi(db: DbGibi, email: string, akis: Akis): Promise<boolean> {
  const [k] = await db
    .select({ kullanildiAni: epostaKuponlari.kullanildiAni })
    .from(epostaKuponlari)
    .where(and(eq(epostaKuponlari.email, email.trim().toLowerCase()), eq(epostaKuponlari.akis, akis)))
    .orderBy(desc(epostaKuponlari.createdAt))
    .limit(1);
  return Boolean(k?.kullanildiAni);
}

export async function kuponAc(
  db: DbGibi,
  girdi: { email: string; akis: Akis; simdi?: Date; govde?: () => string; prova?: boolean; shopify?: ShopifyKuponAcici },
): Promise<KuponSonuc> {
  const simdi = girdi.simdi ?? new Date();
  const email = girdi.email.trim().toLowerCase();
  if (frenUygulanirMi(girdi.akis) && !kuponVerilebilirMi(await sonKuponAni(db, email), simdi)) {
    return { ok: false, sebep: 'fren' };
  }
  const bitisAni = kuponBitisi(girdi.akis, simdi);
  if (!bitisAni) return { ok: false, sebep: 'omur_yok' };
  const kod = kuponKoduUret(girdi.akis, girdi.govde ?? (() => govdeUret()));
  // PROVA (kuru koşu): KARAR aynı yerden verilir (60 gün freni + ömür yukarıda
  // ÖLÇÜLDÜ), yalnız DEFTERE YAZILMAZ. Sebep ölçüldü (#994057, 16 Eki): prova
  // çağrısı gerçek kupon satırı açıyordu ve o satır 60 GÜN FRENİNİ YAKIYORDU —
  // yani "deneme" müşterinin gerçek kupon hakkını harcıyordu.
  if (girdi.prova) {
    return { ok: true, id: 'prova-yazilmadi', kod, bitisAni, indirimYuzde: TABAN_INDIRIM_YUZDE, ustLimitKurus: UST_LIMIT_KURUS };
  }
  // ÖNCE SHOPIFY, SONRA DEFTER: Shopify açamazsa deftere satır YAZILMAZ — freni
  // boşa yakmaz ve "indirim kodunuz" maili kullanılamayan kodla GİTMEZ (çağıran
  // adımı 'atlandi' + sebep işaretler). Ters sıra, defterde ölü kod bırakırdı.
  // Geç yükleme: ödeme kancası (`eposta-kupon-odeme.ts`) bu dosyayı içe aktarıyor;
  // Shopify istemcisi (DB + env) yalnız gerçekten kupon açılırken yüklensin.
  const ac = girdi.shopify ?? (await import('./shopify/eposta-indirim')).shopifyKuponAc;
  const sh = await ac({
    kod, akis: girdi.akis, yuzde: TABAN_INDIRIM_YUZDE, baslangic: simdi, bitis: bitisAni,
  });
  if (!sh.ok) return { ok: false, sebep: 'shopify', hata: sh.hata };
  const [r] = await db
    .insert(epostaKuponlari)
    .values({
      kod,
      email,
      akis: girdi.akis,
      indirimYuzde: TABAN_INDIRIM_YUZDE,
      ustLimitKurus: UST_LIMIT_KURUS,
      bitisAni,
      shopifyIndirimId: sh.id,
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

/** Bizim ürettiğimiz kodun biçimi: HG-/ST-/CT- + 8 karakter (govdeUret alfabesi). */
export const EPOSTA_KOD_DESENI = /^(HG|ST|CT)-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/;

/**
 * SİPARİŞ ANINDA KUPON DAMGASI (#994816) — `kuponKullan`ın ÇAĞIRANI.
 * 13 Eki'den beri `kuponKullan` yazılıydı ama hiçbir yerden çağrılmıyordu; sonuç:
 * kullanım damgası hiç düşmüyor, A2 kuralı ("kodu kullandıysa hatırlatma gitmez")
 * üretimde ASLA tetiklenemiyordu. Sipariş yutucusu (`order-ingest.ts`) bunu çağırır.
 * Yalnız bizim desenimizdeki kodlar sorgulanır; kampanya kodları DB'ye gitmez.
 */
export async function siparisKuponlariniDamgala(
  db: DbGibi,
  girdi: { kodlar: Array<string | null | undefined>; siparisId?: string | null; simdi?: Date },
): Promise<number> {
  const kodlar = [...new Set(girdi.kodlar.map((k) => (k ?? '').trim().toUpperCase()).filter((k) => EPOSTA_KOD_DESENI.test(k)))];
  let damga = 0;
  for (const kod of kodlar) {
    const [k] = await db
      .select({ id: epostaKuponlari.id })
      .from(epostaKuponlari)
      .where(eq(epostaKuponlari.kod, kod))
      .limit(1);
    if (k && (await kuponKullan(db, k.id, girdi.siparisId, girdi.simdi))) damga += 1;
  }
  return damga;
}

export { kuponGecerliMi, indirimTutariKurus };
