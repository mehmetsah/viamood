/**
 * ÇİVİ — #994914: E-POSTA AKIŞI SABİT KUPON MODU (`EPOSTA_SABIT_KUPON`).
 *
 * Yunus 22 Eki 2026 (grup, birebir): «indirim ile ilgili HOSGELDIN10 şeklinde kod
 * açtım, onu kullanabilir diye yazdım». Kod Shopify'da ZATEN açık → akış onu gönderir,
 * `write_discounts` gerekmez. Spec'in güvenceleri (60 gün freni · kişiye kilit ·
 * tek kullanım · 300 TL tavan) SABİT kodda da defter satırından sürer.
 * Sabit mod KAPALIYKEN #994816 davranışı (kişiye özel üretim + Shopify'da açma) birebir
 * sürer — tests/eposta-kisiye-ozel-kupon.test.ts bunu ayrıca tutar.
 * Her kuralın NEGATİF bacağı var — kural kalkarsa test KIRILMALI.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { STOREFRONT_URL: 'https://viamood.com.tr' } }));
vi.mock('@/db/client', () => ({ db: {} }));

import { AKIS, UST_LIMIT_KURUS } from '@/lib/eposta-akis';
import { EPOSTA_KOD_DESENI, bizimKodMu, cozumle, kuponAc, kuponSatirKosulu, sabitKupon, siparisKuponlariniDamgala } from '@/lib/eposta-kupon';
import { PgDialect } from 'drizzle-orm/pg-core';
import { epostaKuponuKisitla } from '@/lib/eposta-kupon-odeme';

const T0 = new Date('2026-10-22T12:00:00Z');
const GUN = 24 * 3600_000;
const SABIT = 'HOSGELDIN10';

/** Sırayla okuma döndüren, yazmaları kaydeden sahte drizzle. */
function sahteDb(okumalar: unknown[][]) {
  const kalan = [...okumalar];
  const yazmalar: Array<{ tur: string; deger?: any }> = [];
  const zincir = (sonuc: () => unknown) => {
    const p: any = {};
    for (const k of ['from', 'innerJoin', 'where', 'orderBy', 'limit', 'set', 'values', 'returning']) p[k] = () => p;
    p.then = (res: any, rej: any) => Promise.resolve(sonuc()).then(res, rej);
    return p;
  };
  const db: any = {
    select: () => zincir(() => kalan.shift() ?? []),
    insert: () => { const z = zincir(() => [{ id: 'kupon-yeni' }]); const v = z.values; z.values = (d: any) => { yazmalar.push({ tur: 'insert', deger: d }); return v(); }; return z; },
    update: () => ({ set: (d: any) => { yazmalar.push({ tur: 'update', deger: d }); return zincir(() => [{ id: 'x' }]); } }),
  };
  return { db, yazmalar };
}

/** Çağrı sayan sahte Shopify açıcı. */
function sahteAcici() {
  const cagri: any[] = [];
  const ac = async (x: any) => { cagri.push(x); return { ok: true as const, id: 'gid://shopify/DiscountCodeNode/1' }; };
  return { ac, cagri };
}

afterEach(() => { delete process.env.EPOSTA_SABIT_KUPON; });

describe('sabitKupon() — env okuma', () => {
  it('trim + büyük harf; boş/eksik = mod KAPALI', () => {
    expect(sabitKupon('  hosgeldin10 ')).toBe(SABIT);
    expect(sabitKupon('')).toBeNull();
    expect(sabitKupon(undefined)).toBeNull();
  });
  it('varsayılan olarak EPOSTA_SABIT_KUPON env değerini okur', () => {
    process.env.EPOSTA_SABIT_KUPON = 'hosgeldin10';
    expect(sabitKupon()).toBe(SABIT);
    expect(bizimKodMu('HOSGELDIN10')).toBe(true);
    delete process.env.EPOSTA_SABIT_KUPON;
    expect(bizimKodMu('HOSGELDIN10')).toBe(false);
  });
});

describe('kuponAc — SABİT mod AÇIK', () => {
  it('Shopify açıcı HİÇ çağrılmaz, kod birebir env kodu, defter satırı yazılır (Shopify kimliği null)', async () => {
    const { db, yazmalar } = sahteDb([[]]);
    const { ac, cagri } = sahteAcici();
    const k = await kuponAc(db, { email: 'A@B.C', akis: AKIS.HOS_GELDIN, simdi: T0, shopify: ac, sabitKod: ' hosgeldin10 ' });
    expect(cagri.length).toBe(0);
    expect(k.ok && k.kod).toBe(SABIT);
    expect(yazmalar).toHaveLength(1);
    expect(yazmalar[0]).toMatchObject({ tur: 'insert', deger: { kod: SABIT, email: 'a@b.c', akis: AKIS.HOS_GELDIN, shopifyIndirimId: null, ustLimitKurus: UST_LIMIT_KURUS } });
    expect(yazmalar[0]!.deger.bitisAni).toBeInstanceOf(Date);
  });

  it('60 GÜN FRENİ sabit kodda da çalışır: aynı e-postaya 10 gün önce terk indirimi verildiyse kupon YOK, defter yazılmaz', async () => {
    const { db, yazmalar } = sahteDb([[{ createdAt: new Date(T0.getTime() - 10 * GUN) }]]);
    const { ac, cagri } = sahteAcici();
    const k = await kuponAc(db, { email: 'a@b.c', akis: AKIS.SEPET_TERKI, simdi: T0, shopify: ac, sabitKod: SABIT });
    expect(k).toEqual({ ok: false, sebep: 'fren' });
    expect(yazmalar).toHaveLength(0);
    expect(cagri.length).toBe(0);
  });

  it('fren 60 gün dolunca açılır (sabit kod yeni satırla tekrar verilir)', async () => {
    const { db, yazmalar } = sahteDb([[{ createdAt: new Date(T0.getTime() - 61 * GUN) }]]);
    const k = await kuponAc(db, { email: 'a@b.c', akis: AKIS.SEPET_TERKI, simdi: T0, shopify: sahteAcici().ac, sabitKod: SABIT });
    expect(k.ok && k.kod).toBe(SABIT);
    expect(yazmalar[0]!.tur).toBe('insert');
  });

  it('PROVA: sabit kod döner ama defter YAZILMAZ', async () => {
    const { db, yazmalar } = sahteDb([[]]);
    const k = await kuponAc(db, { email: 'a@b.c', akis: AKIS.HOS_GELDIN, simdi: T0, prova: true, sabitKod: SABIT });
    expect(k.ok && k.kod).toBe(SABIT);
    expect(yazmalar).toHaveLength(0);
  });
});

describe('kuponAc — SABİT mod KAPALI (regresyon: #994816 davranışı)', () => {
  it('Shopify açıcı çağrılır, kod rastgele kişisel desen', async () => {
    const { db } = sahteDb([[]]);
    const { ac, cagri } = sahteAcici();
    const k = await kuponAc(db, { email: 'a@b.c', akis: AKIS.HOS_GELDIN, simdi: T0, shopify: ac, sabitKod: null });
    expect(cagri.length).toBe(1);
    expect(k.ok && EPOSTA_KOD_DESENI.test(k.kod)).toBe(true);
    expect(k.ok && k.kod).not.toBe(SABIT);
  });
  it('env boşken (varsayılan okuma) de kişisel yol', async () => {
    delete process.env.EPOSTA_SABIT_KUPON;
    const { db } = sahteDb([[]]);
    const { ac, cagri } = sahteAcici();
    await kuponAc(db, { email: 'a@b.c', akis: AKIS.HOS_GELDIN, simdi: T0, shopify: ac });
    expect(cagri.length).toBe(1);
  });
});

describe('cozumle — sabit kodun satırı da kişiye kilitli + tavanlı', () => {
  const satir = { id: 'k1', email: 'a@b.c', bitisAni: new Date(T0.getTime() + 7 * GUN), kullanildiAni: null };
  it('NEGATİF: başkasının e-postasıyla KAPALI', () => {
    expect(cozumle(satir, { email: 'x@y.z', sepetKurus: 100_000 }, T0)).toEqual({ ok: false, sebep: 'baska_kisi' });
  });
  it('300 TL tavan: 5.000 TL sepette indirim 30.000 kuruş', () => {
    const r = cozumle(satir, { email: 'A@B.C', sepetKurus: 500_000 }, T0);
    expect(r.ok && r.indirimKurus).toBe(UST_LIMIT_KURUS);
  });
  it('tek kullanım: damgalı satır kullanılamaz', () => {
    expect(cozumle({ ...satir, kullanildiAni: T0 }, { email: 'a@b.c', sepetKurus: 100_000 }, T0)).toEqual({ ok: false, sebep: 'kullanildi' });
  });
});

describe('defter koşulu — sabit kod (kod, e-posta) ile aranır', () => {
  const sq = (c: any) => new PgDialect().sqlToQuery(c);
  it('sabit kod: koşulda e-posta VAR (başkasının satırıyla çözülmez)', () => {
    process.env.EPOSTA_SABIT_KUPON = SABIT;
    const q = sq(kuponSatirKosulu('hosgeldin10', 'A@B.C'));
    expect(q.sql).toContain('"email"');
    expect(q.params).toEqual([SABIT, 'a@b.c']);
  });
  it('kişisel kod: yalnız kod (tekil)', () => {
    process.env.EPOSTA_SABIT_KUPON = SABIT;
    const q = sq(kuponSatirKosulu('ST-ABCDEFGH', 'a@b.c'));
    expect(q.sql).not.toContain('"email"');
    expect(q.params).toEqual(['ST-ABCDEFGH']);
  });
});

describe('ödeme kancası — sabit kod', () => {
  const satirA = { id: 'k1', email: 'a@b.c', bitisAni: new Date(T0.getTime() + 7 * GUN), kullanildiAni: null };
  /** (kod, e-posta) ile okuyan sahte okuyucu — yalnız A'nın satırı var. */
  const okuyucu = (sorgular: any[]) => async (kod: string, email?: string | null) => {
    sorgular.push({ kod, email });
    return kod === SABIT && (email ?? '').toLowerCase() === 'a@b.c' ? satirA : null;
  };

  it('defterdeki sahibi: 5.000 TL sepette Shopify 500 TL → 300 TL tavan; okuma (kod, e-posta) ile', async () => {
    process.env.EPOSTA_SABIT_KUPON = SABIT;
    const s: any[] = [];
    const r = await epostaKuponuKisitla({ kod: 'hosgeldin10', email: 'a@b.c', amountKurus: 50_000, eligibleSubtotalKurus: 500_000, simdi: T0 }, okuyucu(s));
    expect(r).toEqual({ ok: true, amountKurus: UST_LIMIT_KURUS });
    expect(s[0]).toEqual({ kod: SABIT, email: 'a@b.c' });
  });
  it('NEGATİF: sahibi kodu KULLANDIYSA reddedilir (tek kullanım)', async () => {
    process.env.EPOSTA_SABIT_KUPON = SABIT;
    const r = await epostaKuponuKisitla({ kod: SABIT, email: 'a@b.c', amountKurus: 10_000, eligibleSubtotalKurus: 100_000, simdi: T0 },
      async () => ({ ...satirA, kullanildiAni: T0 }));
    expect(r.ok).toBe(false);
  });
  it('defterde olmayan e-posta (kod başka kanaldan): reddedilmez ama 300 TL TAVAN uygulanır', async () => {
    process.env.EPOSTA_SABIT_KUPON = SABIT;
    const r = await epostaKuponuKisitla({ kod: SABIT, email: 'x@y.z', amountKurus: 50_000, eligibleSubtotalKurus: 500_000, simdi: T0 }, okuyucu([]));
    expect(r).toEqual({ ok: true, amountKurus: UST_LIMIT_KURUS });
  });
  it('e-posta yok (sepet önizlemesi): DB okunmaz, tavan uygulanır', async () => {
    process.env.EPOSTA_SABIT_KUPON = SABIT;
    const s: any[] = [];
    const r = await epostaKuponuKisitla({ kod: SABIT, email: null, amountKurus: 50_000, eligibleSubtotalKurus: 500_000, simdi: T0 }, okuyucu(s));
    expect(r).toEqual({ ok: true, amountKurus: UST_LIMIT_KURUS });
    expect(s).toHaveLength(0);
  });
  it('NEGATİF (mod KAPALI): HOSGELDIN10 kampanya kodu gibi DOKUNULMADAN geçer, DB okunmaz', async () => {
    delete process.env.EPOSTA_SABIT_KUPON;
    const s: any[] = [];
    const r = await epostaKuponuKisitla({ kod: SABIT, email: 'a@b.c', amountKurus: 50_000, eligibleSubtotalKurus: 500_000, simdi: T0 }, okuyucu(s));
    expect(r).toEqual({ ok: true, amountKurus: 50_000 });
    expect(s).toHaveLength(0);
  });
});

describe('sipariş damgası — sabit kod sipariş e-postasının satırına düşer', () => {
  it('sabit kod + e-posta → damga 1 (kullanım kilidi)', async () => {
    process.env.EPOSTA_SABIT_KUPON = SABIT;
    const { db, yazmalar } = sahteDb([[{ id: 'k1' }]]);
    const n = await siparisKuponlariniDamgala(db, { kodlar: ['hosgeldin10'], siparisId: null, simdi: T0, email: 'a@b.c' });
    expect(n).toBe(1);
    expect(yazmalar[0]).toMatchObject({ tur: 'update', deger: { kullanildiAni: T0 } });
  });
  it('NEGATİF: e-posta yoksa sabit kod DAMGALANMAZ (başkasının satırı yakılmaz)', async () => {
    process.env.EPOSTA_SABIT_KUPON = SABIT;
    const { db, yazmalar } = sahteDb([[{ id: 'k1' }]]);
    expect(await siparisKuponlariniDamgala(db, { kodlar: [SABIT], simdi: T0 })).toBe(0);
    expect(yazmalar).toHaveLength(0);
  });
});

describe('şema + göç — kod tekilliği yalnız kişisel kodlarda', () => {
  const goc = readFileSync(new URL('../drizzle/0035_eposta_kupon_sabit_mod.sql', import.meta.url), 'utf8');
  const sema = readFileSync(new URL('../src/db/schema/eposta-akis.ts', import.meta.url), 'utf8');
  it('göç idempotent: IF EXISTS / IF NOT EXISTS, veri silme yok', () => {
    expect(goc).toContain('DROP CONSTRAINT IF EXISTS eposta_kuponlari_kod_key');
    expect(goc).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS eposta_kuponlari_kod_kisisel_uniq\s+ON eposta_kuponlari \(kod\) WHERE kod ~ '\^\(HG\|ST\|CT\)-'/);
    expect(goc).not.toMatch(/\b(DELETE|TRUNCATE|DROP TABLE|DROP COLUMN)\b/i);
  });
  it('şema: kod tam tekil DEĞİL, kısmi tekil dizin var', () => {
    expect(sema).not.toMatch(/kod: text\('kod'\)\.notNull\(\)\.unique\(\)/);
    expect(sema).toContain("uniqueIndex('eposta_kuponlari_kod_kisisel_uniq')");
  });
});
