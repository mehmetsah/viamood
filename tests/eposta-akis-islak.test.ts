/**
 * ISLAK KOŞU — #994816: üç akış GERÇEK Postgres üstünde uçtan uca.
 *
 * Sahte drizzle zinciri SQL'in kendisini ölçmez (WHERE/JOIN/UNIQUE/RETURNING);
 * bu dosya gerçek bir veritabanında koşar. Kapsam: hoş geldin (anında + 2 gün,
 * kod kullanıldıysa hatırlatma YOK) · sepet terki (1sa/24sa/48sa, 60 gün freni) ·
 * checkout terki (sipariş gelince 2. adım İPTAL) · ödeme tavanı · İYS · çift
 * tur yarışında tek mail · prova hiçbir satır yazmaz.
 *
 * ⛔ YALNIZ YALITILMIŞ DB: `EPOSTA_ISLAK_DB` verilmezse ATLANIR. Canlı DB'ye
 *    bağlanmayı reddeder (adında "viamood_eposta_" geçmeyen DB → hata).
 * ⛔ GERÇEK MAİL / GERÇEK SHOPIFY YOK: gönderici ve Shopify açıcı enjekte;
 *    adresler `.invalid` alan adında (RFC 2606 — teslim edilemez).
 *
 *   createdb viamood_eposta_994816 && for f in $(ls drizzle/*.sql | sort -V); do psql -d viamood_eposta_994816 -f $f; done
 *   EPOSTA_ISLAK_DB=postgres://localhost/viamood_eposta_994816 npx vitest run tests/eposta-akis-islak.test.ts
 */
import { writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { STOREFRONT_URL: 'https://viamood.com.tr' } }));
vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/lib/email/sender', () => ({
  sendEmail: async () => ({ ok: false, error: 'ıslak koşu: gerçek gönderici YASAK' }),
  mailKanaliHazir: () => false,
}));

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { AKIS, UST_LIMIT_KURUS } from '@/lib/eposta-akis';
import { gonderimTuru } from '@/lib/eposta-akis-gonderim';
import { hosGeldinTetikle, siparisSonrasiAkis, terkTara } from '@/lib/eposta-akis-tetik';
import { epostaKuponuKisitla } from '@/lib/eposta-kupon-odeme';

const URL_ = process.env.EPOSTA_ISLAK_DB ?? '';
const SAAT = 3600_000;
const GUN = 24 * SAAT;
const T0 = new Date('2026-10-22T09:00:00Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

const gidenler: Array<{ to: string; subject: string; html: string; sablon?: string }> = [];
const shopifyAcilan: Array<{ kod: string; bitis: Date }> = [];
const gonder = async (p: any) => { gidenler.push(p); return { ok: true }; };
const shopify = async (k: { kod: string; bitis: Date }) => { shopifyAcilan.push(k); return { ok: true as const, id: `gid://shopify/DiscountCodeNode/test-${shopifyAcilan.length}` }; };
const kutuk: Record<string, unknown> = {};

describe.skipIf(!URL_)('ıslak koşu — gerçek Postgres', () => {
  let istemci: ReturnType<typeof postgres>;
  let db: any;
  const tur = (simdi: Date, ek: Record<string, unknown> = {}) => gonderimTuru(db, { simdi, gonder, shopify, ...ek });
  const kime = (e: string) => gidenler.filter((g) => g.to === e);
  const kodu = (html: string) => html.match(/\b(HG|ST|CT)-[A-Z2-9]{8}\b/)?.[0] ?? null;

  beforeAll(async () => {
    if (!/viamood_eposta_/.test(URL_)) throw new Error('YALITIM: yalnız viamood_eposta_* veritabanında koşar');
    istemci = postgres(URL_, { max: 4, onnotice: () => {} });
    db = drizzle(istemci, { schema });
    await db.execute(sql`truncate eposta_akis_gonderimleri, eposta_akis_tetikleri, eposta_kuponlari, carts restart identity cascade`);
  });
  afterAll(async () => {
    if (process.env.EPOSTA_ISLAK_KUTUK) writeFileSync(process.env.EPOSTA_ISLAK_KUTUK, JSON.stringify(kutuk, null, 2));
    await istemci?.end();
  });

  it('A · hoş geldin: anında kişiye özel kod; kodu KULLANAN hatırlatma ALMAZ, kullanmayan alır', async () => {
    const A = 'elif-test-a@viamood.invalid', B = 'elif-test-b@viamood.invalid';
    const ta = await hosGeldinTetikle(db, { email: A, iysOnayi: true, simdi: T0 });
    await hosGeldinTetikle(db, { email: B, iysOnayi: true, simdi: T0 });
    // welcome-signup'ın anında gönderimi: yalnız bu tetik
    const o1 = await tur(T0, { tetikId: ta.tetikId });
    expect(o1.gonderildi).toBe(1);
    expect(kime(B)).toHaveLength(0);                // başka tetiğe dokunmadı
    await tur(T0);
    const kodA = kodu(kime(A)[0].html)!;
    expect(kodA).toMatch(/^HG-/);
    expect(kodu(kime(B)[0].html)).not.toBe(kodA);   // kişiye özel: herkese ayrı kod
    const [kup] = await db.select().from(schema.epostaKuponlari).where(eq(schema.epostaKuponlari.kod, kodA));
    expect(kup.email).toBe(A);
    expect(kup.shopifyIndirimId).toMatch(/^gid:\/\/shopify\//);
    expect(kup.bitisAni.getTime() - T0.getTime()).toBe(7 * GUN);  // hoş geldin 7 gün

    // A kodu siparişte kullandı → sipariş kancası damgalar
    expect(await siparisSonrasiAkis(db, { email: A, kodlar: [kodA], siparisId: '00000000-0000-4000-8000-000000000001', simdi: at(SAAT) }))
      .toMatchObject({ damga: 1 });
    // +2 gün: A'ya hatırlatma GİTMEZ, B'ye GİDER
    const o2 = await tur(at(2 * GUN + 60_000));
    expect(kime(A)).toHaveLength(1);
    expect(kime(B)).toHaveLength(2);
    expect(o2.sebepler.kod_kullanildi).toBe(1);
    kutuk.hosGeldin = { anindaTur: o1, ikiGunTur: o2, kodA, kodTekilMi: kodu(kime(B)[0].html) !== kodA };
  });

  it('B · sepet terki: 1sa indirimsiz · 24sa %10 kişisel kod (48 saat) · 48sa son hatırlatma; 60 gün içinde 2. terk indirimi YOK', async () => {
    const C = 'elif-test-c@viamood.invalid';
    await db.insert(schema.carts).values({ token: 'islak-c1', attributes: { email: C }, updatedAt: at(-2 * SAAT) });
    const t = await terkTara(db, { simdi: T0 });
    expect(t).toMatchObject({ tarandi: 1, acilan: 1 });
    expect(t.sinif[AKIS.SEPET_TERKI]).toBe(1);
    await tur(at(59 * 60_000));
    expect(kime(C)).toHaveLength(0);                // 1 saat dolmadan gitmez
    await tur(at(SAAT));
    expect(kime(C)).toHaveLength(1);
    expect(kodu(kime(C)[0].html)).toBeNull();       // 1. adım indirimsiz
    await tur(at(24 * SAAT));
    const kodC = kodu(kime(C)[1].html)!;
    expect(kodC).toMatch(/^ST-/);
    const [kup] = await db.select().from(schema.epostaKuponlari).where(eq(schema.epostaKuponlari.kod, kodC));
    expect(kup.bitisAni.getTime() - at(24 * SAAT).getTime()).toBe(48 * SAAT);
    await tur(at(48 * SAAT));
    expect(kime(C)).toHaveLength(3);
    expect(kodu(kime(C)[2].html)).toBeNull();       // 3. adım indirimsiz

    // 10 gün sonra yeni sepet terk edildi → akış AÇILIR ama %10 adımı FRENLENİR
    await db.insert(schema.carts).values({ token: 'islak-c2', attributes: { email: C }, updatedAt: at(10 * GUN - 2 * SAAT) });
    expect((await terkTara(db, { simdi: at(10 * GUN) })).acilan).toBe(1);
    await tur(at(10 * GUN + SAAT));
    const o = await tur(at(11 * GUN));
    expect(kime(C)).toHaveLength(4);                // yalnız indirimsiz 1. adım gitti
    expect(o.sebepler.kupon_fren).toBe(1);
    kutuk.sepetTerki = { kodC, freniTur: o, mailSayisi: kime(C).length };

    // ÖDEME TAVANI — gerçek defterden okuyan kanca
    const oku = async (kod: string) => {
      const [k] = await db.select().from(schema.epostaKuponlari).where(eq(schema.epostaKuponlari.kod, kod));
      return k ?? null;
    };
    const tavan = await epostaKuponuKisitla({ kod: kodC, email: C, amountKurus: 50_000, eligibleSubtotalKurus: 500_000, simdi: at(30 * SAAT) }, oku);
    expect(tavan).toEqual({ ok: true, amountKurus: UST_LIMIT_KURUS });
    const baska = await epostaKuponuKisitla({ kod: kodC, email: 'baskasi@viamood.invalid', amountKurus: 10_000, eligibleSubtotalKurus: 100_000, simdi: at(30 * SAAT) }, oku);
    expect(baska.ok).toBe(false);
    const gec = await epostaKuponuKisitla({ kod: kodC, email: C, amountKurus: 10_000, eligibleSubtotalKurus: 100_000, simdi: at(73 * SAAT) }, oku);
    expect(gec.ok).toBe(false);                     // 48 saat doldu
    kutuk.odemeTavani = { besBinTL: tavan, baskaKisi: baska, suresiGecti: gec };
  });

  it('C · checkout terki: 1sa güven maili; sipariş gelince 24sa %10 adımı İPTAL', async () => {
    const D = 'elif-test-d@viamood.invalid';
    await db.insert(schema.carts).values({ token: 'islak-d1', attributes: { email: D, address1: 'Moda Cd. 1' }, updatedAt: at(-2 * SAAT) });
    const t = await terkTara(db, { simdi: T0 });
    expect(t.sinif[AKIS.CHECKOUT_TERKI]).toBe(1);
    await tur(at(SAAT));
    expect(kime(D)).toHaveLength(1);
    expect(await siparisSonrasiAkis(db, { email: D, kodlar: [], siparisId: null, simdi: at(2 * SAAT) })).toMatchObject({ iptal: 1 });
    const o = await tur(at(25 * SAAT));
    expect(kime(D)).toHaveLength(1);                // sipariş SONRASI terk maili yok
    const satirlar = await db.execute(sql`select g.adim, g.durum from eposta_akis_gonderimleri g join eposta_akis_tetikleri t on t.id=g.tetik_id where t.email=${D} order by g.adim`);
    expect([...satirlar].map((r: any) => `${r.adim}:${r.durum}`)).toEqual(['1:gonderildi', '2:iptal']);
    kutuk.checkoutTerki = { satirlar: [...satirlar], tur: o };
  });

  it('D · İYS/pazarlama onayı yoksa mail GİTMEZ, SMS satırı hiç PLANLANMAZ', async () => {
    const E = 'elif-test-e@viamood.invalid';
    await hosGeldinTetikle(db, { email: E, iysOnayi: false, simdi: T0 });
    const o = await tur(at(60_000));
    expect(kime(E)).toHaveLength(0);
    expect(o.sebepler.iys_onayi_yok).toBeGreaterThanOrEqual(1);
    const [{ n }] = await db.execute(sql`select count(*)::int n from eposta_akis_gonderimleri where kanal='sms'`);
    expect(n).toBe(0);
    kutuk.iys = { tur: o, smsSatiri: n };
  });

  it('E · iki tur AYNI ANDA koşsa da tek mail (satır sahiplenme)', async () => {
    const F = 'elif-test-f@viamood.invalid';
    await hosGeldinTetikle(db, { email: F, iysOnayi: true, simdi: at(3 * GUN) });
    const [o1, o2] = await Promise.all([tur(at(3 * GUN)), tur(at(3 * GUN))]);
    expect(kime(F)).toHaveLength(1);
    kutuk.yaris = { o1, o2, mail: kime(F).length };
  });

  it('F · PROVA hiçbir satır yazmaz, Shopify\'da kod açmaz, mail göndermez', async () => {
    const G = 'elif-test-g@viamood.invalid';
    await hosGeldinTetikle(db, { email: G, iysOnayi: true, simdi: at(4 * GUN) });
    const iz = async () => (await db.execute(sql`select
      (select md5(coalesce(string_agg(id::text||durum, ',' order by id), '')) from eposta_akis_gonderimleri) g,
      (select count(*) from eposta_kuponlari) k`))[0];
    const once = await iz(); const sOnce = shopifyAcilan.length; const mOnce = gidenler.length;
    const o = await tur(at(4 * GUN), { prova: true });
    expect(o.gonderildi).toBeGreaterThanOrEqual(1);  // ne olacağını raporlar
    expect(await iz()).toEqual(once);
    expect(shopifyAcilan.length).toBe(sOnce);
    expect(gidenler.length).toBe(mOnce);
    kutuk.prova = { tur: o, izDegismedi: true };
    kutuk.toplam = { mail: gidenler.length, shopifyKod: shopifyAcilan.length, alicilar: [...new Set(gidenler.map((g) => g.to))] };
  });
});
