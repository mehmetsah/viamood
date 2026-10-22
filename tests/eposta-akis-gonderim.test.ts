/**
 * #994057 — GÖNDERİM AYAĞI + KUPON + TETİK çivisi.
 *
 * Kapsam: kupon tavanı · kişiye özellik · tek kullanım · birleşmezlik ·
 * 60 gün freni adımı ATLATIR · iptal edilmiş akışa mail GİTMEZ · SMS atlanır ·
 * şablon seçimi · terk sınıflandırması · zamanlayıcı emniyet anahtarı.
 *
 * ⚠ GERÇEK MAİL GİTMEZ, GERÇEK DB'YE DOKUNULMAZ: `gonder` enjekte edilir, db sahte.
 * Her kuralın NEGATİF bacağı var — kural kalkarsa test KIRILMALI.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// env/DB/SMTP zincirini KES: çivi ne gerçek veritabanı ne gerçek mail istiyor.
// (env.ts canlı değişken şeması zorunlu alan ister; test ortamında yok.)
vi.mock('@/lib/env', () => ({
  env: { STOREFRONT_URL: 'https://viamood.com', INTERNAL_API_KEY: 'test-key' },
}));
vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/lib/email/sender', () => ({
  sendEmail: async () => ({ ok: false, error: 'çivi: gerçek mail yok' }),
  mailKanaliHazir: () => false,
}));
import { AKIS, UST_LIMIT_KURUS, indirimTutariKurus } from '@/lib/eposta-akis';
import { DURUM } from '@/lib/eposta-akis-kosucu';
import { BIRLESIR, cozumle, govdeUret } from '@/lib/eposta-kupon';
import { gonderimTuru, kuponluAdimMi } from '@/lib/eposta-akis-gonderim';
import { CHECKOUT_ALANLARI, epostaCikar, terkSinifi } from '@/lib/eposta-akis-tetik';
import { akisMaili, indirimCumlesi } from '@/lib/email/templates';
import { akisAktifMi, cronYetkiliMi } from '@/app/api/cron/eposta-akis/route';

const T0 = new Date('2026-10-13T12:00:00Z');
const KUPON = { id: 'k1', email: 'a@b.c', bitisAni: new Date('2026-10-20T12:00:00Z'), kullanildiAni: null };

/* ── sahte db: zincirli drizzle çağrılarını taklit eder ─────────────────── */
function zincir(sonuc: unknown) {
  const p: any = {};
  for (const k of ['from', 'innerJoin', 'where', 'orderBy', 'limit', 'set', 'values', 'returning']) p[k] = () => p;
  p.then = (res: any, rej: any) => Promise.resolve(sonuc).then(res, rej);
  return p;
}
function sahteDb(secmeler: unknown[], eklemeler: unknown[] = [[{ id: 'kupon-1' }]]) {
  const isaretler: Array<{ durum: string; hataMetni?: string; kuponId?: string }> = [];
  const db: any = {
    transaction: async (fn: any) => fn(db),
    select: () => zincir(secmeler.shift() ?? []),
    insert: () => zincir(eklemeler.shift() ?? [{ id: 'kupon-1' }]),
    update: () => ({
      set: (v: any) => {
        // satirSahiplen (#994816): 'isleniyor' geçişi 1 satır döner = sahiplenildi.
        if (v?.durum === DURUM.ISLENIYOR) return zincir([{ id: 'sahip' }]);
        if (v && typeof v.durum === 'string') isaretler.push(v);
        return zincir([]);
      },
    }),
  };
  return { db, isaretler };
}
/** Shopify kod açıcısı — çivi gerçek mağazaya YAZMAZ (#994816). */
const SHOPIFY_OK = async () => ({ ok: true as const, id: 'gid://shopify/DiscountCodeNode/1' });
const SATIR = (ek: Partial<{ adim: number; kanal: string }> = {}) => [
  { id: 'g1', tetikId: 't1', adim: ek.adim ?? 1, planlananAn: T0, kanal: ek.kanal ?? 'eposta' },
];
const TETIK = (ek: Record<string, unknown> = {}) => [
  { akis: AKIS.HOS_GELDIN, email: 'a@b.c', cartId: null, iptalSebebi: null, iysOnayi: true, ...ek },
];

/* ── 1) KUPON TUTARI — tavan yüzdeyi düşürmez, TUTARI tavanlar ─────────── */
describe('kupon tutarı ve tavan', () => {
  it('1.500 TL tam sınırda %10 AYNEN geçer (tavan devreye girmez)', () => {
    expect(indirimTutariKurus(150_000)).toBe(15_000);
  });
  it('5.000 TL sepette indirim 300 TL ile TAVANLANIR', () => {
    expect(indirimTutariKurus(500_000)).toBe(UST_LIMIT_KURUS);
  });
  it('NEGATİF: tavan "yüzde düşsün" demek DEĞİL — 1.600 TL de %10 değil tavanla sınırlı hesaplanır', () => {
    expect(indirimTutariKurus(160_000)).toBe(16_000);          // tavan altı: ham değer
    expect(indirimTutariKurus(10_000_000)).toBe(UST_LIMIT_KURUS); // tavan üstü: 300 TL
  });
});

/* ── 2) ÇÖZÜMLEME — kişiye özel · tek kullanım · süre · birleşmezlik ───── */
describe('kupon çözümleme', () => {
  it('sahibi kullanırsa geçer ve tavanlı tutarı döner', () => {
    const r = cozumle(KUPON, { email: 'A@B.C', sepetKurus: 500_000 }, T0);
    expect(r).toMatchObject({ ok: true, indirimKurus: UST_LIMIT_KURUS });
  });
  it('NEGATİF: BAŞKASI kullanamaz (kişiye özel)', () => {
    expect(cozumle(KUPON, { email: 'x@y.z', sepetKurus: 10_000 }, T0)).toMatchObject({ ok: false, sebep: 'baska_kisi' });
  });
  it('NEGATİF: e-posta HİÇ verilmezse de geçmez (kod herkese açık olmaz)', () => {
    expect(cozumle(KUPON, { sepetKurus: 10_000 }, T0)).toMatchObject({ ok: false, sebep: 'baska_kisi' });
  });
  it('NEGATİF: kullanılmış kupon ölüdür (tek kullanım)', () => {
    expect(cozumle({ ...KUPON, kullanildiAni: T0 }, { email: 'a@b.c', sepetKurus: 10_000 }, T0))
      .toMatchObject({ ok: false, sebep: 'kullanildi' });
  });
  it('NEGATİF: süresi geçmiş kupon geçmez (sınır DAHİL ölü)', () => {
    expect(cozumle(KUPON, { email: 'a@b.c', sepetKurus: 10_000 }, KUPON.bitisAni))
      .toMatchObject({ ok: false, sebep: 'suresi_gecti' });
  });
  it('NEGATİF: başka indirim varsa ÜST ÜSTE BİNMEZ (combinations kapalı)', () => {
    expect(BIRLESIR).toBe(false);
    expect(cozumle(KUPON, { email: 'a@b.c', sepetKurus: 10_000, baskaIndirimVar: true }, T0))
      .toMatchObject({ ok: false, sebep: 'birlesmez' });
  });
  it('kod gövdesi karışan harf/rakam İÇERMEZ ve tahmin edilebilir kaynak kullanmaz', () => {
    const g = govdeUret(8, (n) => Buffer.alloc(n, 0));
    expect(g).toHaveLength(8);
    expect(/[01OIL]/.test(g)).toBe(false);
    expect(readFileSync('src/lib/eposta-kupon.ts', 'utf8')).not.toMatch(/Math\.random\(/);
  });
});

/* ── 3) ADIM-KUPON EŞLEŞMESİ — spec'in tablosu ─────────────────────────── */
describe('hangi adım kuponlu', () => {
  it('spec: hoş geldin 1 · sepet terki 2 · checkout terki 2 kuponlu', () => {
    expect(kuponluAdimMi(AKIS.HOS_GELDIN, 1)).toBe(true);
    expect(kuponluAdimMi(AKIS.SEPET_TERKI, 2)).toBe(true);
    expect(kuponluAdimMi(AKIS.CHECKOUT_TERKI, 2)).toBe(true);
  });
  it('NEGATİF: ilk hatırlatmalar indirimsizdir', () => {
    expect(kuponluAdimMi(AKIS.SEPET_TERKI, 1)).toBe(false);
    expect(kuponluAdimMi(AKIS.SEPET_TERKI, 3)).toBe(false);
    expect(kuponluAdimMi(AKIS.CHECKOUT_TERKI, 1)).toBe(false);
  });
});

/* ── 4) GÖNDERİM TURU — dal dal ────────────────────────────────────────── */
describe('gönderim turu', () => {
  it('kuponlu adımı gönderir, kuponu satıra damgalar', async () => {
    const { db, isaretler } = sahteDb([SATIR(), TETIK()]);
    const gidenler: any[] = [];
    const o = await gonderimTuru(db, { simdi: T0, shopify: SHOPIFY_OK, gonder: async (p) => { gidenler.push(p); return { ok: true }; } });
    expect(o).toMatchObject({ tarandi: 1, gonderildi: 1, hata: 0 });
    expect(gidenler[0].tip).toBe('pazarlama');                     // çıkış linki zorunlu sınıf
    expect(gidenler[0].sablon).toBe(`akis:${AKIS.HOS_GELDIN}:1`);
    // #994816 (Yunus 21 Eki spec'i): gövdeye KİŞİYE ÖZEL kod girer, sabit kod GİRMEZ.
    expect(gidenler[0].html).toMatch(/HG-[A-Z2-9]{8}/);
    expect(gidenler[0].html).not.toContain('HOSGELDIN10');   // NEGATİF: paylaşılan kod geri gelmedi
    expect(isaretler[0]).toMatchObject({ durum: DURUM.GONDERILDI, kuponId: 'kupon-1' });
  });

  it('60 GÜN FRENİ: kupon verilmezse adım ATLANIR — kuponsuz "indirim kodunuz" maili GİTMEZ', async () => {
    // sonKuponAni = 10 gün önce ⇒ fren açık (fren yalnız TERK akışlarında — spec)
    const { db, isaretler } = sahteDb([SATIR({ adim: 2 }), TETIK({ akis: AKIS.SEPET_TERKI }), [{ createdAt: new Date(T0.getTime() - 10 * 864e5) }]]);
    const gidenler: any[] = [];
    const o = await gonderimTuru(db, { simdi: T0, shopify: SHOPIFY_OK, gonder: async (p) => { gidenler.push(p); return { ok: true }; } });
    expect(gidenler).toHaveLength(0);
    expect(o).toMatchObject({ gonderildi: 0, atlandi: 1 });
    expect(o.sebepler.kupon_fren).toBe(1);
    expect(isaretler[0]).toMatchObject({ durum: DURUM.ATLANDI });
  });

  it('NEGATİF: pazarlama onayı yoksa mail ve kupon gönderilmez', async () => {
    const { db, isaretler } = sahteDb([SATIR(), TETIK({ iysOnayi: false })]);
    const gidenler: any[] = [];
    const o = await gonderimTuru(db, { simdi: T0, gonder: async (p) => { gidenler.push(p); return { ok: true }; } });
    expect(gidenler).toHaveLength(0);
    expect(o.sebepler.iys_onayi_yok).toBe(1);
    expect(isaretler[0]).toMatchObject({ durum: DURUM.ATLANDI });
  });

  it('İPTAL EDİLMİŞ akışa mail GİTMEZ (sipariş verdi / abonelikten çıktı)', async () => {
    const { db, isaretler } = sahteDb([SATIR(), TETIK({ iptalSebebi: 'donusum' })]);
    const gidenler: any[] = [];
    const o = await gonderimTuru(db, { simdi: T0, gonder: async (p) => { gidenler.push(p); return { ok: true }; } });
    expect(gidenler).toHaveLength(0);
    expect(o.sebepler['iptal:donusum']).toBe(1);
    expect(isaretler[0]).toMatchObject({ durum: DURUM.IPTAL });
  });

  it('SMS kanalı atlanır (sağlayıcı yapılandırılmadı) — sessizce yutulmaz, sebebi yazılır', async () => {
    const { db, isaretler } = sahteDb([SATIR({ kanal: 'sms', adim: 3 }), TETIK({ akis: AKIS.SEPET_TERKI })]);
    const o = await gonderimTuru(db, { simdi: T0, gonder: async () => ({ ok: true }) });
    expect(o.sebepler.sms_saglayici_yok).toBe(1);
    expect(isaretler[0]?.hataMetni).toMatch(/SMS/);
  });

  it('gönderici başarısız dönerse satır HATA damgalanır (sessiz başarı YOK)', async () => {
    const { db, isaretler } = sahteDb([SATIR(), TETIK()]);
    const o = await gonderimTuru(db, { simdi: T0, shopify: SHOPIFY_OK, gonder: async () => ({ ok: false, error: 'smtp reddetti' }) });
    expect(o).toMatchObject({ gonderildi: 0, hata: 1 });
    expect(isaretler[0]).toMatchObject({ durum: DURUM.HATA, hataMetni: 'smtp reddetti' });
  });

  it('bir satırın istisnası TURU DÜŞÜRMEZ', async () => {
    const { db } = sahteDb([SATIR(), TETIK()]);
    const o = await gonderimTuru(db, { simdi: T0, shopify: SHOPIFY_OK, gonder: async () => { throw new Error('patladı'); } });
    expect(o).toMatchObject({ tarandi: 1, hata: 1 });
    expect(o.sebepler.istisna).toBe(1);
  });
});

/* ── 5) ŞABLONLAR ──────────────────────────────────────────────────────── */
describe('akış şablonları', () => {
  it('yedi adımın hepsinin metni var', () => {
    const hepsi: Array<[string, number]> = [
      [AKIS.HOS_GELDIN, 1], [AKIS.HOS_GELDIN, 2],
      [AKIS.SEPET_TERKI, 1], [AKIS.SEPET_TERKI, 2], [AKIS.SEPET_TERKI, 3],
      [AKIS.CHECKOUT_TERKI, 1], [AKIS.CHECKOUT_TERKI, 2],
    ];
    for (const [akis, adim] of hepsi) {
      const m = akisMaili({ akis, adim, kod: 'HG-TEST1234', bitisAni: T0 });
      expect(m, `${akis}/${adim}`).not.toBeNull();
      expect(m!.subject.length).toBeGreaterThan(5);
    }
  });
  it('NEGATİF: kuponlu adım KODSUZ çağrılırsa şablon null döner (yanlış mail üretilmez)', () => {
    expect(akisMaili({ akis: AKIS.SEPET_TERKI, adim: 2, kod: null })).toBeNull();
    expect(akisMaili({ akis: AKIS.HOS_GELDIN, adim: 1, kod: '' })).toBeNull();
  });
  it('NEGATİF: bilinmeyen akış/adım null döner, throw ETMEZ (tur düşmesin)', () => {
    expect(akisMaili({ akis: 'olmayan', adim: 9 })).toBeNull();
    expect(akisMaili({ akis: AKIS.CHECKOUT_TERKI, adim: 7 })).toBeNull();
  });
  it('indirim cümlesi spec ile BİREBİR: %10 · 1.500₺ · 300₺', () => {
    const c = indirimCumlesi(10, 1500, 300);
    expect(c).toContain('%10');
    expect(c).toContain('1.500₺');
    expect(c).toContain('300₺');
  });
  it('emoji kullanılmadı (sahip kuralı)', () => {
    const m = akisMaili({ akis: AKIS.SEPET_TERKI, adim: 2, kod: 'ST-ABCD2345', bitisAni: T0 })!;
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(m.html + m.subject)).toBe(false);
  });
});

/* ── 6) TETİK SINIFLANDIRMA + EMNİYET ANAHTARI ─────────────────────────── */
describe('terk sınıflandırma', () => {
  it('checkout alanı dolu sepet CHECKOUT terkidir', () => {
    for (const k of CHECKOUT_ALANLARI) {
      expect(terkSinifi({ [k]: 'dolu' })).toBe(AKIS.CHECKOUT_TERKI);
    }
  });
  it('NEGATİF: boş/boşluklu checkout alanı sepet terkine düşer', () => {
    expect(terkSinifi({ address1: '   ', payment_method: '' })).toBe(AKIS.SEPET_TERKI);
    expect(terkSinifi(null)).toBe(AKIS.SEPET_TERKI);
  });
  it('e-posta attributes içinden çıkarılır, yoksa null', () => {
    expect(epostaCikar({ email: ' Musteri@Example.COM ' })).toBe('musteri@example.com');
    expect(epostaCikar({ customer_email: 'x@y.z' })).toBe('x@y.z');
    expect(epostaCikar({ email: 'gecersiz' })).toBeNull();
    expect(epostaCikar(null)).toBeNull();
  });
});

describe('zamanlayıcı yetki başlığı', () => {
  it('yalnız Bearer ve doğru sır kabul edilir, URL query yetki sayılmaz', () => {
    expect(cronYetkiliMi('Bearer test-key', 'test-key')).toBe(true);
    expect(cronYetkiliMi(null, 'test-key')).toBe(false);
    expect(cronYetkiliMi('test-key', 'test-key')).toBe(false);
    expect(cronYetkiliMi('Bearer wrong', 'test-key')).toBe(false);
    expect(cronYetkiliMi('Bearer test-key', '')).toBe(false);
  });
});

describe('zamanlayıcı emniyet anahtarı', () => {
  it('varsayılan KAPALI — anahtar verilmedikçe mail gitmez', () => {
    expect(akisAktifMi(undefined)).toBe(false);
    expect(akisAktifMi('')).toBe(false);
    expect(akisAktifMi('0')).toBe(false);
    expect(akisAktifMi('true')).toBe(false);
  });
  it('yalnız "1" açar', () => {
    expect(akisAktifMi('1')).toBe(true);
    expect(akisAktifMi(' 1 ')).toBe(true);
  });
});
