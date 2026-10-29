/**
 * E-POSTA AKIŞI TAKİP PANELİ — VERİ KATMANI (#995400, Yunus 29 Eki 2026).
 *
 * Yunus (birebir): «Tutulan veriyi ve mail gönderildi ise gönderildi ve zaman
 * bilgisini görebileceğimiz panel yeterlidir. Sıfırdan kurmaya gerek yoktur.»
 *
 * ⚠ YALNIZ OKUR. Yeni tablo/kolon yok, hiçbir satıra yazmaz — #994057'de kurulan
 * defterin (`welcome_signups` + `eposta_akis_tetikleri` + `eposta_akis_gonderimleri`)
 * üstüne görünürlük katmanıdır. Gönderim/tetik mantığı burada YENİDEN YAZILMAZ.
 *
 * İKİ LİSTE, çünkü kaynakları farklı:
 *   · FORM  → anasayfa formu (`welcome_signups`). Akış açıldıysa (20 Eki'den sonra)
 *             mailler `eposta_akis_gonderimleri`nden; akıştan ÖNCEKİ kayıtlarda
 *             mail doğrudan gönderilmişti, sonucu kaydın kendi alanlarındadır
 *             (`email_status` / `email_sent_at`).
 *   · TERK  → sepet / checkout terki (`eposta_akis_tetikleri`). Bunların form kaydı
 *             yoktur; kişi yalnız e-postasıyla görünür.
 *
 * Form ile akış E-POSTAYLA eşlenir: hoş geldin akışı adres başına bir kez açılır
 * (`hosGeldinTetikle`, 'zaten_var'), iki tarafta da adres küçük harfle yazılır.
 */
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { AKIS, ADIMLAR, type Akis } from './eposta-akis';
import { DURUM } from './eposta-akis-kosucu';
import { epostaAkisGonderimleri, epostaAkisTetikleri, welcomeSignups } from '@/db/schema';

export const TERK_AKISLARI_TAKIP = [AKIS.SEPET_TERKI, AKIS.CHECKOUT_TERKI] as const;

export const AKIS_ADI: Record<string, string> = {
  [AKIS.HOS_GELDIN]: 'Hoş geldin',
  [AKIS.SEPET_TERKI]: 'Sepet terki',
  [AKIS.CHECKOUT_TERKI]: 'Checkout terki',
};

/** Ekranda görünen durum — yalnız "gitti mi, ne zaman" sorusunu cevaplar. */
export type MailHali = 'gonderildi' | 'bekliyor' | 'gonderilmedi' | 'hata';

export const HAL_YAZISI: Record<MailHali, string> = {
  gonderildi: 'gönderildi',
  bekliyor: 'bekliyor',
  gonderilmedi: 'gönderilmedi',
  hata: 'hata',
};

export interface MailSatiri {
  /** Akış adımı (1, 2, 3). Akış öncesi doğrudan gönderimde null. */
  adim: number | null;
  hal: MailHali;
  /** Gönderildiyse gönderim anı; bekliyorsa planlanan an; ikisi de yoksa null. */
  zaman: Date | null;
  /** `zaman` neyi gösteriyor — ekranda "planlanan" diye ayrılır. */
  zamanTuru: 'gonderim' | 'planlanan' | null;
  /** Atlanma/hata sebebi (kodun yazdığı metin — kişisel veri taşımaz). */
  not: string | null;
}

export interface TakipSatiri {
  id: string;
  /** Form satırında form zamanı; terk satırında tetik zamanı. */
  an: Date;
  ad: string | null;
  email: string;
  akis: string | null;
  /** Akış erken durduysa sebebi (sipariş verdi, abonelikten çıktı…). */
  akisDurdu: string | null;
  /** Akış bu form kaydından ÖNCE, aynı adresin eski bir kaydıyla açılmıştı. */
  oncekiKayitlaAcildi: boolean;
  mailler: MailSatiri[];
}

const DURDU_YAZISI: Record<string, string> = {
  donusum: 'sipariş verdi, akış durdu',
  abonelik_iptal: 'abonelikten çıktı, akış durdu',
  elle: 'elle durduruldu',
};

type TetikSatiri = {
  id: string; akis: string; email: string; tetikAni: Date; iptalSebebi: string | null;
};
type GonderimSatiri = {
  tetikId: string; adim: number; durum: string; planlananAn: Date;
  gonderimAni: Date | null; hataMetni: string | null;
};
type FormSatiri = {
  id: string; name: string; email: string; createdAt: Date;
  emailStatus: string; emailSentAt: Date | null; emailError: string | null;
};

/** SAF — defterdeki `durum` → ekrandaki hal. Sözlük dışı bir değer "hata" sayılır: sessizce "bekliyor" görünmesin. */
export function adimHali(durum: string): MailHali {
  switch (durum) {
    case DURUM.GONDERILDI: return 'gonderildi';
    case DURUM.PLANLANDI:
    case DURUM.ISLENIYOR: return 'bekliyor';
    case DURUM.ATLANDI:
    case DURUM.IPTAL: return 'gonderilmedi';
    default: return 'hata';
  }
}

/** SAF — bir akışın gönderim satırları → ekran satırları (adım sırasıyla). */
export function akisMailleri(gonderimler: GonderimSatiri[]): MailSatiri[] {
  return [...gonderimler]
    .sort((a, b) => a.adim - b.adim)
    .map((g) => {
      const hal = adimHali(g.durum);
      const gitti = hal === 'gonderildi' && g.gonderimAni;
      return {
        adim: g.adim,
        hal,
        zaman: gitti ? g.gonderimAni : hal === 'bekliyor' ? g.planlananAn : g.gonderimAni,
        zamanTuru: gitti ? 'gonderim' : hal === 'bekliyor' ? 'planlanan' : g.gonderimAni ? 'gonderim' : null,
        not: g.durum === DURUM.IPTAL ? 'akış durduğu için gönderilmedi' : g.hataMetni,
      };
    });
}

/**
 * SAF — akış ÖNCESİ form kaydı (doğrudan gönderim yolu) → tek mail satırı.
 * 'skipped' = mail GİTMEDİ; sebebi `email_error`dadır (kod tanımsız / kanal
 * tanımsız — welcome-signup.ts). Akışın devraldığı kayıtlar buraya yalnız akış
 * satırı BULUNAMAZSA düşer; o zaman da sebep metni ("akışı devraldı") görünür.
 */
export function dogrudanMail(f: Pick<FormSatiri, 'emailStatus' | 'emailSentAt' | 'emailError'>): MailSatiri {
  const hal: MailHali =
    f.emailStatus === 'sent' ? 'gonderildi'
      : f.emailStatus === 'pending' ? 'bekliyor'
        : f.emailStatus === 'skipped' ? 'gonderilmedi'
          : 'hata';
  return {
    adim: null,
    hal,
    zaman: f.emailSentAt,
    zamanTuru: f.emailSentAt ? 'gonderim' : null,
    not: hal === 'gonderilmedi' || hal === 'hata' ? f.emailError : null,
  };
}

/** Form ile tetik aynı istekte yazılır; ikisi arasındaki farkın bu payı aşması "başka kayıt" demektir. */
const ONCEKI_KAYIT_PAYI_MS = 60_000;

/**
 * SAF — form kaydı + (varsa) akış tetiği + gönderimleri → tek ekran satırı.
 *
 * ⚠ Eşleme e-postayla olduğu için aynı adresin AKIŞTAN ÖNCEKİ eski form kaydı da
 * aynı tetiği bulur (ölçüldü: canlıda 3 adres formu 2-3 kez doldurmuş). Tetikten
 * önce açılmış kayıt o akışı AÇMAMIŞTIR ⇒ kendi doğrudan gönderim sonucunu gösterir;
 * yoksa Eylül'deki kayıt Ekim'deki akış maillerini kendi mailiymiş gibi gösterirdi.
 */
export function formSatiriKur(f: FormSatiri, tetikAday: TetikSatiri | undefined, gonderimler: GonderimSatiri[]): TakipSatiri {
  const tetik = tetikAday && tetikAday.tetikAni.getTime() - f.createdAt.getTime() > ONCEKI_KAYIT_PAYI_MS ? undefined : tetikAday;
  if (!tetik) {
    return {
      id: f.id, an: f.createdAt, ad: f.name, email: f.email,
      akis: null, akisDurdu: null, oncekiKayitlaAcildi: false,
      mailler: [dogrudanMail(f)],
    };
  }
  return {
    id: f.id, an: f.createdAt, ad: f.name, email: f.email,
    akis: tetik.akis,
    akisDurdu: tetik.iptalSebebi ? (DURDU_YAZISI[tetik.iptalSebebi] ?? tetik.iptalSebebi) : null,
    oncekiKayitlaAcildi: f.createdAt.getTime() - tetik.tetikAni.getTime() > ONCEKI_KAYIT_PAYI_MS,
    mailler: akisMailleri(gonderimler.filter((g) => g.tetikId === tetik.id)),
  };
}

/** SAF — terk tetiği → ekran satırı. */
export function terkSatiriKur(t: TetikSatiri, gonderimler: GonderimSatiri[]): TakipSatiri {
  return {
    id: t.id, an: t.tetikAni, ad: null, email: t.email,
    akis: t.akis,
    akisDurdu: t.iptalSebebi ? (DURDU_YAZISI[t.iptalSebebi] ?? t.iptalSebebi) : null,
    oncekiKayitlaAcildi: false,
    mailler: akisMailleri(gonderimler.filter((g) => g.tetikId === t.id)),
  };
}

/** Adım etiketi — akışın kendi tanımından (ADIMLAR) türetilir, panelde ikinci katalog yazılmaz. */
export function adimEtiketi(akis: string | null, adim: number | null): string {
  if (adim == null) return 'Hoş geldin maili (akış öncesi, doğrudan)';
  const a = akis ? ADIMLAR[akis as Akis]?.find((x) => x.adim === adim) : undefined;
  if (!a) return `${adim}. mail`;
  const saat = Math.round(a.gecikmeMs / 3_600_000);
  const zaman = saat === 0 ? 'anında' : saat % 24 === 0 ? `+${saat / 24} gün` : `+${saat} sa`;
  return `${adim}. mail · ${zaman}${a.kupon ? ' · kuponlu' : ''}`;
}

// ─── DB okuma ───────────────────────────────────────────────────────────────

type DbOkur = { select: (...a: any[]) => any };

async function gonderimleriGetir(db: DbOkur, tetikIdleri: string[]): Promise<GonderimSatiri[]> {
  if (tetikIdleri.length === 0) return [];
  return db
    .select({
      tetikId: epostaAkisGonderimleri.tetikId,
      adim: epostaAkisGonderimleri.adim,
      durum: epostaAkisGonderimleri.durum,
      planlananAn: epostaAkisGonderimleri.planlananAn,
      gonderimAni: epostaAkisGonderimleri.gonderimAni,
      hataMetni: epostaAkisGonderimleri.hataMetni,
    })
    .from(epostaAkisGonderimleri)
    .where(inArray(epostaAkisGonderimleri.tetikId, tetikIdleri));
}

/** İki listenin toplam sayısı — sekme etiketleri için. */
export async function takipSayilari(db: DbOkur): Promise<{ form: number; terk: number }> {
  const [f] = await db.select({ n: count() }).from(welcomeSignups);
  const [t] = await db
    .select({ n: count() })
    .from(epostaAkisTetikleri)
    .where(inArray(epostaAkisTetikleri.akis, [...TERK_AKISLARI_TAKIP]));
  return { form: Number(f?.n ?? 0), terk: Number(t?.n ?? 0) };
}

/** Form kayıtları (yeniden eskiye) + her kaydın hoş geldin akışı ve mailleri. */
export async function formSatirlari(db: DbOkur, o: { limit: number; offset: number }): Promise<TakipSatiri[]> {
  const formlar: FormSatiri[] = await db
    .select({
      id: welcomeSignups.id,
      name: welcomeSignups.name,
      email: welcomeSignups.email,
      createdAt: welcomeSignups.createdAt,
      emailStatus: welcomeSignups.emailStatus,
      emailSentAt: welcomeSignups.emailSentAt,
      emailError: welcomeSignups.emailError,
    })
    .from(welcomeSignups)
    .orderBy(desc(welcomeSignups.createdAt))
    .limit(o.limit)
    .offset(o.offset);
  if (formlar.length === 0) return [];

  const adresler = [...new Set(formlar.map((f) => f.email.trim().toLowerCase()))];
  const tetikler: TetikSatiri[] = await db
    .select({
      id: epostaAkisTetikleri.id,
      akis: epostaAkisTetikleri.akis,
      email: epostaAkisTetikleri.email,
      tetikAni: epostaAkisTetikleri.tetikAni,
      iptalSebebi: epostaAkisTetikleri.iptalSebebi,
    })
    .from(epostaAkisTetikleri)
    .where(and(eq(epostaAkisTetikleri.akis, AKIS.HOS_GELDIN), inArray(epostaAkisTetikleri.email, adresler)));
  const tetikAdresle = new Map(tetikler.map((t) => [t.email, t]));
  const gonderimler = await gonderimleriGetir(db, tetikler.map((t) => t.id));

  return formlar.map((f) => formSatiriKur(f, tetikAdresle.get(f.email.trim().toLowerCase()), gonderimler));
}

/** Sepet / checkout terki tetikleri (yeniden eskiye) + mailleri. */
export async function terkSatirlari(db: DbOkur, o: { limit: number; offset: number }): Promise<TakipSatiri[]> {
  const tetikler: TetikSatiri[] = await db
    .select({
      id: epostaAkisTetikleri.id,
      akis: epostaAkisTetikleri.akis,
      email: epostaAkisTetikleri.email,
      tetikAni: epostaAkisTetikleri.tetikAni,
      iptalSebebi: epostaAkisTetikleri.iptalSebebi,
    })
    .from(epostaAkisTetikleri)
    .where(inArray(epostaAkisTetikleri.akis, [...TERK_AKISLARI_TAKIP]))
    .orderBy(desc(epostaAkisTetikleri.tetikAni))
    .limit(o.limit)
    .offset(o.offset);
  const gonderimler = await gonderimleriGetir(db, tetikler.map((t) => t.id));
  return tetikler.map((t) => terkSatiriKur(t, gonderimler));
}
