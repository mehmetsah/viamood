/**
 * ÇİVİ — #994057: Yunus'un 16 Eki kararlarından ÜÇÜ (HOSGELDIN10 ayrı çivide).
 *
 *  (1) SMS ŞİMDİLİK YOK — 48. saat hatırlatması e-postadan gider.
 *  (2) GÖNDEREN ADRESİ varsayılanı `info@viamood.com`.
 *  (3) ÜYE EŞLEŞTİRMESİ — sepette e-posta yoksa ÜYE kaydındaki adres kullanılır.
 *
 * (1) ve (3) DAVRANIŞ ayağıyla ölçülüyor (metin eşleşmesi değil): gerçek
 * `ADIMLAR` tablosu ve gerçek `terkTara()` koşuyor.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADIMLAR, AKIS } from '@/lib/eposta-akis';

const acilanlar: Array<{ akis: string; email: string }> = [];
vi.mock('@/lib/eposta-akis-kosucu', () => ({
  akisBaslat: vi.fn(async (_db: unknown, g: { akis: string; email: string }) => {
    acilanlar.push({ akis: g.akis, email: g.email });
    return { tetikId: 'tetik-1' };
  }),
  akisIptal: vi.fn(async () => 0),
}));

/** Sırayla sonuç döndüren sahte drizzle — her select zinciri kuyruktan bir sonuç alır. */
function sahteDb(kuyruk: unknown[][]) {
  const kalan = [...kuyruk];
  const zincir = () => {
    const o: Record<string, unknown> = {};
    o.from = () => o;
    o.where = () => o;
    o.limit = () => Promise.resolve(kalan.shift() ?? []);
    return o;
  };
  return {
    select: () => zincir(),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    insert: () => ({ values: async () => undefined }),
    transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({}),
  } as never;
}

beforeEach(() => { acilanlar.length = 0; });

describe('(1) SMS şimdilik yok — 48. saat e-postadan', () => {
  it('hiçbir adımda sms:true KALMADI', () => {
    const smsli = Object.entries(ADIMLAR).flatMap(([a, ads]) =>
      ads.filter((x) => x.sms).map((x) => `${a}#${x.adim}`),
    );
    expect(smsli).toEqual([]);   // sağlayıcı gelince yine ['sepet_terki#3'] olmalı
  });

  it('zamanlama DEĞİŞMEDİ — 3. adım yine 48 saat, kuponsuz', () => {
    const ucuncu = ADIMLAR[AKIS.SEPET_TERKI].find((a) => a.adim === 3);
    expect(ucuncu).toMatchObject({ gecikmeMs: 48 * 3600_000, kupon: false, sms: false });
  });
});

describe('(2) gönderen adresi', () => {
  it('EMAIL_FROM varsayılanı info@viamood.com', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/lib/env.ts', import.meta.url), 'utf8');
    expect(src).toContain("EMAIL_FROM: z.string().default('Via Mood <info@viamood.com>')");
    expect(src).not.toContain('noreply@viamood.com');   // NEGATİF: eski adres kalmadı
  });
});

describe('(3) üye eşleştirmesi — terkTara davranışı', () => {
  it('sepette e-posta YOK ama ÜYE bağlı → müşteri kaydındaki adrese akış açılır', async () => {
    const { terkTara } = await import('@/lib/eposta-akis-tetik');
    const db = sahteDb([
      [{ id: 'sepet-1', token: 'tk', attributes: {}, customerId: 'musteri-9' }],  // sepetler
      [{ email: '  Uye@Viamood.com ' }],                                          // müşteri kaydı
    ]);
    const ozet = await terkTara(db, { simdi: new Date('2026-10-16T12:00:00Z') });
    expect(ozet).toMatchObject({ tarandi: 1, acilan: 1, epostasiz: 0 });
    expect(acilanlar).toEqual([{ akis: AKIS.SEPET_TERKI, email: 'uye@viamood.com' }]);  // kırpılıp küçültülüyor
  });

  it('NEGATİF — ANONİM (customerId yok) sepet yine e-postasız sayılır, akış AÇILMAZ', async () => {
    const { terkTara } = await import('@/lib/eposta-akis-tetik');
    const db = sahteDb([[{ id: 'sepet-2', token: 'tk2', attributes: {}, customerId: null }]]);
    const ozet = await terkTara(db, { simdi: new Date('2026-10-16T12:00:00Z') });
    expect(ozet).toMatchObject({ tarandi: 1, acilan: 0, epostasiz: 1 });
    expect(acilanlar).toEqual([]);
  });

  it('sepette e-posta VARSA üye sorgusuna hiç gidilmez (öncelik nitelikte)', async () => {
    const { terkTara } = await import('@/lib/eposta-akis-tetik');
    // Kuyrukta müşteri sonucu YOK — eğer sorgu yapılırsa [] döner ve e-posta kaybolurdu.
    const db = sahteDb([[{ id: 'sepet-3', token: 'tk3', attributes: { email: 'sepet@viamood.com' }, customerId: 'musteri-9' }]]);
    const ozet = await terkTara(db, { simdi: new Date('2026-10-16T12:00:00Z') });
    expect(ozet).toMatchObject({ acilan: 1, epostasiz: 0 });
    expect(acilanlar[0]?.email).toBe('sepet@viamood.com');
  });
});
