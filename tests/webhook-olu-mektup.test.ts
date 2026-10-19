/**
 * ÇİVİ — #994753 · R1: Shopify webhook hata yolu.
 *
 * ÖLÇÜLEN ARIZA (19 Eki 2026, Okan · P0-A incelemesi) İKİ YÖNLÜYDÜ:
 *  (a) Dış `catch` TÜM istisnalarda HTTP 200 dönüyordu ("retry storm'a yol
 *      açmamak için"). Bu bloğa yalnız GEÇİCİ hatalar düşer (DB tıkanması, ağ),
 *      yani her veritabanı kesintisi o anki siparişleri KALICI olarak yok
 *      ediyordu — Shopify "başardı" sanıp bir daha denemiyordu.
 *  (b) PR #1 (e20b0c7) bunu düzeltmek isterken ters tarafı kırdı: KALICI
 *      doğrulama hatasını (`line_items` boş) 503 yaptı. Kalıcı hatada ısrar
 *      Shopify'ın ~48 saat sonra ABONELİĞİ devre dışı bırakmasına yol açar;
 *      bir siparişi kaybetmek yerine HEPSİNİ kaybetmek olurdu.
 *
 * Doğru davranış: yanıt kodu hatanın TİPİNE bağlıdır (kalıcı → 200, geçici →
 * 503) ve ham gövde HER İKİ hâlde ölü mektuba yazılır — yani kod ne olursa
 * olsun veri kaybı yoktur. Bu dosya davranışı ölçer (yalnız kaynak grep değil).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { govdeKirp, oluMektupYaz, HAM_GOVDE_TAVANI } from '@/lib/shopify/olu-mektup';

/** Yazılanı kaydeden sahte db — gerçek bağlantı açmaz. */
function sahteDb() {
  const yazilan: Record<string, unknown>[] = [];
  return {
    yazilan,
    insert: () => ({ values: async (v: Record<string, unknown>) => { yazilan.push(v); } }),
  };
}
/** Her yazmada fırlatan sahte db — ölü mektup yazıcısının yutma garantisi için. */
function patlayanDb() {
  return { insert: () => ({ values: async () => { throw new Error('DB yok'); } }) };
}

describe('#994753 R1 · ölü mektup yazıcısı', () => {
  it('tavanın altındaki gövdeye DOKUNMAZ', () => {
    expect(govdeKirp('{"id":1}')).toBe('{"id":1}');
    expect(govdeKirp(null)).toBeNull();
  });

  it('tavanı aşan gövdeyi kırpar ve kırpıldığını AÇIKÇA yazar (sessiz kesme yok)', () => {
    const ham = 'x'.repeat(HAM_GOVDE_TAVANI + 500);
    const k = govdeKirp(ham)!;
    expect(k.length).toBeLessThan(ham.length);
    expect(k).toContain('KIRPILDI');
    expect(k).toContain(String(ham.length));
  });

  it('kalıcı ve geçici hatayı AYRI kaydeder, ham gövdeyi saklar', async () => {
    const db = sahteDb();
    expect(await oluMektupYaz({ konu: 'orders/create', webhookId: 'w1', shopDomain: 's.myshopify.com',
      kalici: true, hata: 'line_items eksik', hamGovde: '{"id":9}' }, db as never)).toBe(true);
    expect(await oluMektupYaz({ konu: 'orders/create', webhookId: 'w2',
      kalici: false, hata: 'DB tıkandı', hamGovde: '{"id":10}' }, db as never)).toBe(true);
    expect(db.yazilan).toHaveLength(2);
    expect(db.yazilan[0]).toMatchObject({ konu: 'orders/create', webhookId: 'w1', kalici: true,
      hata: 'line_items eksik', hamGovde: '{"id":9}' });
    expect(db.yazilan[1]).toMatchObject({ kalici: false, hamGovde: '{"id":10}' });
    // Boş geçilen alanlar undefined DEĞİL null olmalı: kolon NULL kabul ediyor.
    expect(db.yazilan[1].shopDomain).toBeNull();
  });

  it('NEGATİF — yazma düşerse FIRLATMAZ, false döner', async () => {
    // Bu garanti kritiktir: yazıcı bir hata yolunun İÇİNDE çağrılır; burada
    // atılan istisna zaten başarısız isteğin yanıt KODUNU da bozardı.
    await expect(oluMektupYaz({ konu: 'orders/create', kalici: false, hata: 'x' },
      patlayanDb() as never)).resolves.toBe(false);
  });
});

describe('#994753 R1 · ingest hata tipi', () => {
  it('KALICI doğrulama hatası retryable:false taşır', async () => {
    // `order-ingest` üst düzeyde `@/db/client`'ı içe alıyor ve o modül
    // DATABASE_URL yoksa fırlatıyor. Ölçtüğümüz yol gövdeyi doğrulayıp DB'ye
    // HİÇ dokunmadan dönüyor; bağlantı KURULMAZ, yalnız modül yüklenebilsin.
    process.env.DATABASE_URL ||= 'postgres://civi:civi@127.0.0.1:1/civi';
    const { ingestShopifyOrder } = await import('@/lib/shopify/order-ingest');
    const r = await ingestShopifyOrder({ id: 1, line_items: [] } as never);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retryable).toBe(false);
      expect(r.error).toMatch(/line_items/);
    }
  });

  it('IngestErr tipi retryable alanını ZORUNLU kılar (varsayılan yok)', () => {
    const src = readFileSync(join(__dirname, '..', 'src', 'lib', 'shopify', 'order-ingest.ts'), 'utf8');
    expect(src).toContain('retryable: boolean;');
    expect(src).not.toContain('retryable?: boolean');
  });
});

describe('#994753 R1 · webhook ucu yanıt kodunu hata TİPİNE göre seçer', () => {
  const src = readFileSync(join(__dirname, '..', 'src', 'app', 'api', 'shopify', 'webhooks',
    'route.ts'), 'utf8');
  // Yorumlar iddiayı kendi başına doğrulamasın: kıyas gövde üzerinde yapılır.
  const kod = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter((l) => !l.trim().startsWith('//')).join('\n');

  it('kalıcı hatada 200, geçici hatada 503 dönen dallanma VAR', () => {
    expect(kod).toContain('result.retryable');
    expect(kod).toMatch(/result\.retryable[\s\S]{0,200}status: 503/);
    expect(kod).toMatch(/result\.retryable[\s\S]{0,300}status: 200/);
  });

  it('NEGATİF — dış catch artık 200 DÖNMEZ, 503 döner', () => {
    const disCatch = kod.slice(kod.lastIndexOf('} catch (err)'));
    expect(disCatch).toContain('status: 503');
    expect(disCatch).not.toContain('status: 200');
  });

  it('her hata yolu ölü mektuba yazar — ham gövde hiçbir kodda kaybolmaz', () => {
    const cagri = kod.match(/oluMektupYaz\(/g) ?? [];
    expect(cagri.length).toBeGreaterThanOrEqual(3); // orders · products · dış catch
    expect(kod).toContain('hamGovde: rawBody');
  });
});
