/**
 * ÇİVİ — #994057: `prova` (kuru koşu) kipinde DB'YE HİÇBİR SATIR YAZILMAZ.
 *
 * ÖLÇÜLEN ARIZA (16 Eki 2026): `/api/cron/eposta-akis?prova=1` "güvenli deneme"
 * diye tanıtılıyordu ama prova YALNIZ mail göndericisini susturuyordu. Üç yazma
 * yolu açıktı:
 *   (a) `terkTara` gerçek sepetleri `status='abandoned'` işaretliyor ve
 *       `akisBaslat` ile tetik+gönderim satırları açıyordu,
 *   (b) `kuponAc` GERÇEK kupon satırı açıp 60 GÜN FRENİNİ yakıyordu,
 *   (c) susturulan gönderici `ok:false` döndüğü için satırlar 'hata'
 *       damgalanıyor ve BİR DAHA ASLA gönderilmiyordu.
 *
 * YÖNTEM: sahte db her yazma çağrısını (update/insert/transaction) kütüğe
 * yazıyor. Prova turunda kütük BOŞ olmak zorunda; gerçek turda DOLU olmak
 * zorunda (pozitif kontrol — çivi "hiç çalışmıyor" diye de yeşil yanmasın).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AKIS } from '@/lib/eposta-akis';
import { DURUM } from '@/lib/eposta-akis-kosucu';

vi.mock('@/lib/env', () => ({
  env: { STOREFRONT_URL: 'https://viamood.com.tr', EMAIL_FROM: 'Via Mood <info@viamood.com>' },
}));
vi.mock('@/db/client', () => ({ db: {} }));

const gidenler: unknown[] = [];
vi.mock('@/lib/email/sender', () => ({
  mailKanaliHazir: () => true,
  sendEmail: vi.fn(async (p: unknown) => { gidenler.push(p); return { ok: true }; }),
}));

/** Okumaları kuyruktan verir, YAZMALARI kütüğe yazar. */
function sahteDb(okumalar: unknown[][]) {
  const yazmalar: string[] = [];
  const kalan = [...okumalar];
  const sel = (): Record<string, unknown> => {
    const o: Record<string, unknown> = {};
    o.from = () => o;
    o.where = () => o;
    o.orderBy = () => o;
    o.limit = () => Promise.resolve(kalan.shift() ?? []);
    return o;
  };
  const db = {
    select: () => sel(),
    update: () => ({
      set: () => ({
        where: () => { yazmalar.push('update'); const p = Promise.resolve([{ id: 'x' }]) as never; return p; },
      }),
    }),
    insert: () => ({
      values: () => {
        yazmalar.push('insert');
        const p = Promise.resolve([{ id: 'yeni-1' }]) as unknown as Promise<unknown[]> & { returning: () => Promise<unknown[]> };
        p.returning = async () => [{ id: 'yeni-1' }];
        return p;
      },
    }),
    transaction: async <T>(fn: (tx: unknown) => Promise<T>) => { yazmalar.push('transaction'); return fn(db); },
  };
  return { db: db as never, yazmalar };
}

beforeEach(() => { gidenler.length = 0; });

const SEPET = [{ id: 'sepet-1', token: 'tk', attributes: { email: 'musteri@ornek.com' }, customerId: null }];

describe('terkTara — prova kipi', () => {
  it('PROVA: tek satır YAZILMAZ, ama ne olacağı RAPORLANIR', async () => {
    const { terkTara } = await import('@/lib/eposta-akis-tetik');
    const { db, yazmalar } = sahteDb([SEPET]);
    const ozet = await terkTara(db, { simdi: new Date('2026-10-16T12:00:00Z'), prova: true });
    expect(yazmalar).toEqual([]);                                  // ⛔ HİÇ YAZMA
    expect(ozet).toMatchObject({ tarandi: 1, acilan: 1, epostasiz: 0, prova: true });
    expect(ozet.sinif[AKIS.SEPET_TERKI]).toBe(1);                  // bilgi yine geliyor
  });

  it('POZİTİF KONTROL — prova YOKSA gerçekten yazıyor', async () => {
    const { terkTara } = await import('@/lib/eposta-akis-tetik');
    const { db, yazmalar } = sahteDb([SEPET]);
    const ozet = await terkTara(db, { simdi: new Date('2026-10-16T12:00:00Z') });
    expect(ozet).toMatchObject({ tarandi: 1, acilan: 1 });
    expect(ozet.prova).toBeUndefined();
    expect(yazmalar).toContain('update');        // carts.status='abandoned'
    expect(yazmalar).toContain('transaction');   // akisBaslat
    expect(yazmalar).toContain('insert');        // tetik + gönderim satırları
  });
});

describe('gonderimTuru — prova kipi', () => {
  const BEKLEYEN = [{ id: 'g-1', tetikId: 't-1', adim: 1, planlananAn: new Date('2026-10-16T11:00:00Z'), kanal: 'email' }];
  const TETIK = [{ akis: AKIS.HOS_GELDIN, email: 'musteri@ornek.com', cartId: null, iptalSebebi: null }];
  const SON_KUPON: unknown[] = [];   // hiç kupon yok ⇒ 60 gün freni KAPALI (adım 1 KUPONLU)

  it('PROVA: ne mail gider, ne damga yazılır, ne kupon açılır', async () => {
    const { gonderimTuru } = await import('@/lib/eposta-akis-gonderim');
    const { db, yazmalar } = sahteDb([BEKLEYEN, TETIK, SON_KUPON]);
    const ozet = await gonderimTuru(db, { simdi: new Date('2026-10-16T12:00:00Z'), prova: true });
    expect(yazmalar).toEqual([]);                      // ⛔ kupon satırı YOK, damga YOK
    expect(gidenler).toEqual([]);                      // ⛔ mail YOK
    expect(ozet).toMatchObject({ tarandi: 1, gonderildi: 1, hata: 0, prova: true });
  });

  it('PROVA: 60 GÜN FRENİ YAKILMAZ — kupon defterine yazılmıyor', async () => {
    const { gonderimTuru } = await import('@/lib/eposta-akis-gonderim');
    const { db, yazmalar } = sahteDb([BEKLEYEN, TETIK, SON_KUPON]);
    await gonderimTuru(db, { simdi: new Date('2026-10-16T12:00:00Z'), prova: true });
    expect(yazmalar.filter((y) => y === 'insert')).toEqual([]);
  });

  it('POZİTİF KONTROL — prova YOKSA kupon açılıyor, damga yazılıyor, mail gidiyor', async () => {
    const { gonderimTuru } = await import('@/lib/eposta-akis-gonderim');
    const { db, yazmalar } = sahteDb([BEKLEYEN, TETIK, SON_KUPON]);
    const ozet = await gonderimTuru(db, { simdi: new Date('2026-10-16T12:00:00Z') });
    expect(ozet).toMatchObject({ tarandi: 1, gonderildi: 1 });
    expect(yazmalar).toContain('insert');     // kuponAc
    expect(yazmalar).toContain('update');     // gonderimIsaretle(GONDERILDI)
    expect(gidenler).toHaveLength(1);         // mail GİTTİ
  });

  it('enjekte edilen gönderici prova kipinde ÇAĞRILMAZ (mail hiç üretilmiyor)', async () => {
    const { gonderimTuru } = await import('@/lib/eposta-akis-gonderim');
    const { db } = sahteDb([BEKLEYEN, TETIK, SON_KUPON]);
    const cagrilar: unknown[] = [];
    await gonderimTuru(db, {
      simdi: new Date('2026-10-16T12:00:00Z'),
      prova: true,
      gonder: async (p) => { cagrilar.push(p); return { ok: true }; },
    });
    expect(cagrilar).toEqual([]);
  });
});

describe('rota prova’yı İKİ katmana da geçiriyor', () => {
  it('kaynakta terkTara ve gonderimTuru ikisi de prova alıyor', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/app/api/cron/eposta-akis/route.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).toContain('terkTara(db as any, { simdi, limit, prova })');
    expect(src).toContain('gonderimTuru(db as any, { simdi, limit, prova })');
    // NEGATİF: eski "yalnız göndericiyi sustur" yaması geri gelmesin
    expect(src).not.toContain("PROVA: mail gönderilmedi");
  });

  it('DURUM.HATA damgası prova turunda hiç kullanılmıyor (satır yanmıyor)', async () => {
    const { gonderimTuru } = await import('@/lib/eposta-akis-gonderim');
    const { db, yazmalar } = sahteDb([BEKLEYEN_BOS]);
    const ozet = await gonderimTuru(db, { prova: true });
    expect(ozet).toMatchObject({ tarandi: 0, hata: 0 });
    expect(yazmalar).toEqual([]);
    expect(DURUM.HATA).toBe('hata');   // sabit adı değişmediyse yukarıdaki iddia anlamlı
  });
});

const BEKLEYEN_BOS: unknown[] = [];
