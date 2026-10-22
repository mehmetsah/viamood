/**
 * ÇİVİ — #994816: e-postaya giden indirim kodu KİŞİYE ÖZEL ve TEK KULLANIMLIKTIR.
 *
 * Yunus 21 Eki 2026 spec'i (birebir): «Tüm kodlar kişiye özel ve tek kullanımlık
 * olmalı … Kod kampanyalarıyla çakışmayı Shopify "combinations" ayarından
 * kapatın». 16 Eki'deki sabit HOSGELDIN10 yolu (tests/eposta-sabit-kupon.test.ts)
 * bu spec'le KALDIRILDI; bu dosya onun yerini alır ve geri gelmesini engeller.
 *
 * Kapsam: Shopify mutation değişkenleri · Shopify açamazsa defter YAZILMAZ ·
 * ödeme kancası (tavan, kişi kilidi, tek kullanım, kampanya kodlarına DOKUNMAMA) ·
 * sipariş kancası (kullanım damgası + dönüşüm freni) · 60 gün freninin kapsamı.
 * Her kuralın NEGATİF bacağı var — kural kalkarsa test KIRILMALI.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { STOREFRONT_URL: 'https://viamood.com.tr' } }));
vi.mock('@/db/client', () => ({ db: {} }));

import { AKIS, FREN_AKISLARI, UST_LIMIT_KURUS, frenUygulanirMi } from '@/lib/eposta-akis';
import { EPOSTA_KOD_DESENI, kuponAc, siparisKuponlariniDamgala } from '@/lib/eposta-kupon';
import { epostaKuponuKisitla } from '@/lib/eposta-kupon-odeme';
import { indirimGirdisi } from '@/lib/shopify/eposta-indirim';
import { donusumIptal, siparisSonrasiAkis } from '@/lib/eposta-akis-tetik';

const T0 = new Date('2026-10-22T12:00:00Z');
const yorumsuz = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Sırayla okuma döndüren, yazmaları kaydeden sahte drizzle. */
function sahteDb(okumalar: unknown[][], guncellemeSonucu: unknown[] = [{ id: 'x' }]) {
  const kalan = [...okumalar];
  const yazmalar: Array<{ tur: string; deger?: any }> = [];
  const zincir = (sonuc: () => unknown) => {
    const p: any = {};
    for (const k of ['from', 'innerJoin', 'where', 'orderBy', 'limit', 'set', 'values', 'returning']) p[k] = () => p;
    p.then = (res: any, rej: any) => Promise.resolve(sonuc()).then(res, rej);
    return p;
  };
  const db: any = {
    transaction: async (fn: any) => fn(db),
    select: () => zincir(() => kalan.shift() ?? []),
    insert: () => { const z = zincir(() => [{ id: 'kupon-yeni' }]); const v = z.values; z.values = (d: any) => { yazmalar.push({ tur: 'insert', deger: d }); return v(); }; return z; },
    update: () => ({ set: (d: any) => { yazmalar.push({ tur: 'update', deger: d }); return zincir(() => guncellemeSonucu); } }),
  };
  return { db, yazmalar };
}

/* ── 1) SHOPIFY KODU — tek kullanımlık, süreli, kampanyayla birleşmez ─── */
describe('Shopify indirim kodu girdisi', () => {
  const g = indirimGirdisi({ kod: 'ST-ABCDEFGH', akis: AKIS.SEPET_TERKI, yuzde: 10, baslangic: T0, bitis: new Date(T0.getTime() + 48 * 3600_000) });
  it('TEK KULLANIM: usageLimit 1 + müşteri başına 1', () => {
    expect(g.usageLimit).toBe(1);
    expect(g.appliesOncePerCustomer).toBe(true);
  });
  it('%10, tüm ürünler, bitiş defterdeki süre (terk: 48 saat)', () => {
    expect(g.customerGets.value.percentage).toBeCloseTo(0.1);
    expect(g.endsAt).toBe('2026-10-24T12:00:00.000Z');
  });
  it('COMBINATIONS: ürün/sipariş indirimiyle BİRLEŞMEZ', () => {
    expect(g.combinesWith.productDiscounts).toBe(false);
    expect(g.combinesWith.orderDiscounts).toBe(false);
  });
  it('müşteri seçimi "all" — müşteriye kilitli kod discount-resolve tarafından fail-closed reddedilirdi', () => {
    expect(g.customerSelection).toEqual({ all: true });
  });
});

/* ── 2) kuponAc — Shopify'sız defter yok, fren yalnız terk akışlarında ─── */
describe('kuponAc', () => {
  it('Shopify açarsa kişisel kod + Shopify kimliği deftere yazılır', async () => {
    const { db, yazmalar } = sahteDb([[]]);
    const acilan: any[] = [];
    const k = await kuponAc(db, { email: 'A@B.C', akis: AKIS.SEPET_TERKI, simdi: T0,
      shopify: async (x) => { acilan.push(x); return { ok: true, id: 'gid://shopify/DiscountCodeNode/9' }; } });
    expect(k.ok).toBe(true);
    expect(k.ok && EPOSTA_KOD_DESENI.test(k.kod)).toBe(true);
    expect(acilan[0].kod).toBe(k.ok ? k.kod : '');
    expect(yazmalar[0]).toMatchObject({ tur: 'insert', deger: { email: 'a@b.c', shopifyIndirimId: 'gid://shopify/DiscountCodeNode/9' } });
  });
  it('NEGATİF: Shopify AÇAMAZSA defter satırı YAZILMAZ (fren yanmaz, ölü kod gönderilmez)', async () => {
    const { db, yazmalar } = sahteDb([[]]);
    const k = await kuponAc(db, { email: 'a@b.c', akis: AKIS.SEPET_TERKI, simdi: T0,
      shopify: async () => ({ ok: false, hata: 'Access denied for discountCodeBasicCreate' }) });
    expect(k).toMatchObject({ ok: false, sebep: 'shopify' });
    expect(yazmalar).toEqual([]);
  });
  it('NEGATİF: 60 gün içinde ikinci SEPET TERKİ indirimi verilmez', async () => {
    const { db, yazmalar } = sahteDb([[{ createdAt: new Date(T0.getTime() - 30 * 864e5) }]]);
    let shopifyCagrildi = false;
    const k = await kuponAc(db, { email: 'a@b.c', akis: AKIS.CHECKOUT_TERKI, simdi: T0,
      shopify: async () => { shopifyCagrildi = true; return { ok: true, id: 'x' }; } });
    expect(k).toMatchObject({ ok: false, sebep: 'fren' });
    expect(shopifyCagrildi).toBe(false);
    expect(yazmalar).toEqual([]);
  });
  it('60 gün DOLDUYSA terk indirimi yeniden verilir', async () => {
    const { db } = sahteDb([[{ createdAt: new Date(T0.getTime() - 61 * 864e5) }]]);
    const k = await kuponAc(db, { email: 'a@b.c', akis: AKIS.SEPET_TERKI, simdi: T0, shopify: async () => ({ ok: true, id: 'x' }) });
    expect(k.ok).toBe(true);
  });
  it('hoş geldin kodu freni YAKMAZ (spec: "sepet terki indirimi") — kova yalnız terk akışları', () => {
    expect(FREN_AKISLARI).toEqual([AKIS.SEPET_TERKI, AKIS.CHECKOUT_TERKI]);
    expect(frenUygulanirMi(AKIS.HOS_GELDIN)).toBe(false);
  });
});

/* ── 3) ÖDEME KANCASI — tavan · kişi kilidi · tek kullanım ────────────── */
describe('ödeme anında e-posta kuponu kısıtı', () => {
  const SATIR = { id: 'k1', email: 'a@b.c', bitisAni: new Date(T0.getTime() + 864e5), kullanildiAni: null };
  const oku = async () => SATIR;
  it('1.500 TL ÜSTÜ sepette indirim 300 TL TAVANI AŞMAZ (5.000 TL → 300, 500 değil)', async () => {
    const r = await epostaKuponuKisitla({ kod: 'ST-ABCDEFGH', email: 'a@b.c', amountKurus: 50_000, eligibleSubtotalKurus: 500_000, simdi: T0 }, oku);
    expect(r).toEqual({ ok: true, amountKurus: UST_LIMIT_KURUS });
  });
  it('tavan altı sepette %10 aynen geçer (1.200 TL → 120 TL)', async () => {
    const r = await epostaKuponuKisitla({ kod: 'ST-ABCDEFGH', email: 'a@b.c', amountKurus: 12_000, eligibleSubtotalKurus: 120_000, simdi: T0 }, oku);
    expect(r).toEqual({ ok: true, amountKurus: 12_000 });
  });
  it('NEGATİF: kod BAŞKA e-postayla kullanılamaz (kişiye özel)', async () => {
    const r = await epostaKuponuKisitla({ kod: 'ST-ABCDEFGH', email: 'baska@x.y', amountKurus: 10_000, eligibleSubtotalKurus: 100_000, simdi: T0 }, oku);
    expect(r.ok).toBe(false);
  });
  it('NEGATİF: kullanılmış kod ikinci kez geçmez (tek kullanım)', async () => {
    const r = await epostaKuponuKisitla({ kod: 'ST-ABCDEFGH', email: 'a@b.c', amountKurus: 10_000, eligibleSubtotalKurus: 100_000, simdi: T0 },
      async () => ({ ...SATIR, kullanildiAni: T0 }));
    expect(r.ok).toBe(false);
  });
  it('NEGATİF: defter okunamazsa bizim desenimizdeki kod tavansız GEÇMEZ (fail-closed)', async () => {
    const r = await epostaKuponuKisitla({ kod: 'HG-ABCDEFGH', email: 'a@b.c', amountKurus: 90_000, eligibleSubtotalKurus: 900_000, simdi: T0 },
      async () => { throw new Error('db yok'); });
    expect(r.ok).toBe(false);
  });
  it('KAMPANYA KODU ETKİLENMEZ: %20 / 5.000 TL → 1.000 TL aynen, DB\'ye bile gidilmez', async () => {
    let okundu = false;
    const r = await epostaKuponuKisitla({ kod: 'KASIM20', email: 'a@b.c', amountKurus: 100_000, eligibleSubtotalKurus: 500_000, simdi: T0 },
      async () => { okundu = true; return SATIR; });
    expect(r).toEqual({ ok: true, amountKurus: 100_000 });
    expect(okundu).toBe(false);
  });
  it('discount-resolve kancayı ÇAĞIRIYOR ve sonucu tutara yazıyor (çağıran var)', () => {
    const src = yorumsuz(readFileSync('src/lib/shopify/discount-resolve.ts', 'utf8'));
    expect(src).toContain('await epostaKuponuKisitla(');
    expect(src).toContain('amountKurus = ek.amountKurus;');
  });
});

/* ── 4) SİPARİŞ KANCASI — damga + dönüşüm freni ───────────────────────── */
describe('sipariş sonrası', () => {
  it('siparişteki e-posta kodu DAMGALANIR, kampanya kodu sorgulanmaz', async () => {
    const { db, yazmalar } = sahteDb([[{ id: 'k1' }]]);
    const n = await siparisKuponlariniDamgala(db, { kodlar: ['KASIM20', 'st-abcdefgh'], siparisId: 'sip-1', simdi: T0 });
    expect(n).toBe(1);
    expect(yazmalar[0]).toMatchObject({ tur: 'update', deger: { kullanildiAni: T0, kullanilanSiparisId: 'sip-1' } });
  });
  it('dönüşüm freni yalnız TERK akışlarını kapatır (sorgu kapsamı)', () => {
    const src = yorumsuz(readFileSync('src/lib/eposta-akis-tetik.ts', 'utf8'));
    const govde = src.slice(src.indexOf('export async function donusumIptal'), src.indexOf('export async function siparisSonrasiAkis'));
    expect(govde).toContain('inArray(epostaAkisTetikleri.akis, [...TERK_AKISLARI])');
  });
  it('açık terk akışı varsa sipariş onu İPTAL eder', async () => {
    const { db, yazmalar } = sahteDb([[{ id: 't1' }]]);
    expect(await donusumIptal(db, 'a@b.c')).toBe(1);
    expect(yazmalar.some((y) => y.deger?.iptalSebebi === 'donusum')).toBe(true);
  });
  it('siparisSonrasiAkis iki işi birden yapar', async () => {
    const { db } = sahteDb([[{ id: 'k1' }], [{ id: 't1' }]]);
    expect(await siparisSonrasiAkis(db, { email: 'a@b.c', kodlar: ['HG-ABCDEFGH'], siparisId: 's', simdi: T0 })).toEqual({ damga: 1, iptal: 1 });
  });
  it('order-ingest kancayı ÇAĞIRIYOR (md.47: çağıran var)', () => {
    const src = yorumsuz(readFileSync('src/lib/shopify/order-ingest.ts', 'utf8'));
    expect(src).toContain('await siparisSonrasiAkis(');
    expect(src).toContain('payload.discount_codes');
  });
  it('NEGATİF: sabit HOSGELDIN10 yolu gönderim katmanına GERİ GELMEDİ', () => {
    const src = yorumsuz(readFileSync('src/lib/eposta-akis-gonderim.ts', 'utf8'));
    expect(src).toContain('kod = k.kod;');
    expect(src).not.toContain('HOSGELDIN10');
    expect(src).not.toContain('SABIT_KUPON_KODU');
  });
});
