/**
 * Kart iadesi — davranış çivileri.
 *
 * Buradaki iddialar para hareketiyle ilgili olduğu için "güzel olur" değil,
 * "yanlışsa para kaybolur" sınıfındadır.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shopifySiparisNotuEkle } from '@/lib/halkode/iade-not';

const ORIJINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  process.env.SHOPIFY_STORE_DOMAIN = 'ornek.myshopify.com';
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'sahte-token';
});
afterEach(() => {
  globalThis.fetch = ORIJINAL_FETCH;
});

describe('shopifySiparisNotuEkle', () => {
  it('mevcut notu SİLMEZ, altına ekler', async () => {
    let gonderilen: Record<string, unknown> | null = null;
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') {
        return new Response(JSON.stringify({ order: { note: 'kargo: PTT 12345' } }), { status: 200 });
      }
      gonderilen = JSON.parse(String(init.body)) as Record<string, unknown>;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    const s = await shopifySiparisNotuEkle('123', {
      tutarTl: 10, tarih: new Date('2026-09-21T12:00:00Z'), durum: 'başarılı', invoiceId: 'vm0x',
    });
    expect(s).toBe('yazildi');
    const not = String((gonderilen as unknown as { order: { note: string } }).order.note);
    expect(not).toContain('kargo: PTT 12345'); // eski not duruyor
    expect(not).toContain('iade: 10.00 TL');
    expect(not).toContain('işlem: vm0x');
  });

  it('aynı iade İKİNCİ kez yazılmaz (çift not koruması)', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ order: { note: 'iade: 10.00 TL · işlem: vm0x' } }), { status: 200 }),
    ) as typeof fetch;
    expect(await shopifySiparisNotuEkle('123', {
      tutarTl: 10, tarih: new Date(), durum: 'başarılı', invoiceId: 'vm0x',
    })).toBe('zaten yazili');
  });

  it('Shopify kimliği yoksa SESSİZCE geçmez, sebebini döndürür', async () => {
    delete process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    expect(await shopifySiparisNotuEkle('123', {
      tutarTl: 5, tarih: new Date(), durum: 'başarılı', invoiceId: 'x',
    })).toBe('atlandi: shopify kimligi yok');
  });

  it('gid:// biçimli sipariş kimliğinden sayısal id çıkarır', async () => {
    const cagrilan: string[] = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      cagrilan.push(String(url));
      if (!init || init.method !== 'PUT') return new Response(JSON.stringify({ order: { note: '' } }), { status: 200 });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    await shopifySiparisNotuEkle('gid://shopify/Order/987654', {
      tutarTl: 1, tarih: new Date(), durum: 'başarılı', invoiceId: 'q',
    });
    expect(cagrilan[0]).toContain('/orders/987654.json');
    expect(cagrilan[0]).not.toContain('gid');
  });

  it('sipariş okunamazsa iade başarısı etkilenmez — sebep döner', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 404 })) as typeof fetch;
    expect(await shopifySiparisNotuEkle('123', {
      tutarTl: 1, tarih: new Date(), durum: 'başarılı', invoiceId: 'q',
    })).toBe('okunamadi: HTTP 404');
  });
});
