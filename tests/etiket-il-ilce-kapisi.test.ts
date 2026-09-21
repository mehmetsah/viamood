/**
 * Etiket kesilmeden önceki il-ilçe kapısı (#1164 / #1169).
 *
 * Shopify ili posta kodundan yeniden yazınca sipariş "Ankara / Erbaa" gibi
 * imkânsız bir çiftle kaydediliyor ve KargoLab etiketi yanlış ile kesiliyordu.
 * Kural: ilçe, kayıtlı ilin listesinde yoksa etiket KESİLMEZ.
 *
 * Harf farkları sahte red üretmemeli (CLAUDE.md §3c, 9. madde: tek yerel seçmek
 * seçilmeyen dili eler). Vitrin formu il/ilçeyi aynı JSON'dan seçtirdiği için
 * doğru bir çift bu kapıya takılmaz — 60 günlük salt okur ölçümde de takılan yok.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── createFulfillmentForOrderVendor'ı DB/KargoLab'siz koşturmak için sahteler ──
const kuyruk: unknown[][] = [];
function sorgu(sonuc: unknown) {
  const b: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'limit', 'leftJoin', 'innerJoin', 'orderBy', 'set', 'values', 'returning']) {
    b[m] = () => b;
  }
  b.then = (ok: (v: unknown) => unknown, hata: (e: unknown) => unknown) => Promise.resolve(sonuc).then(ok, hata);
  return b;
}
const eklenenler: unknown[] = [];
const guncellenenler: unknown[] = [];
const dbSahte = {
  select: vi.fn(() => sorgu(kuyruk.shift() ?? [])),
  insert: vi.fn(() => {
    const b = sorgu([{ id: 'claim-1' }]) as Record<string, unknown>;
    b.values = (v: unknown) => {
      eklenenler.push(v);
      return b;
    };
    return b;
  }),
  update: vi.fn(() => {
    const b = sorgu(undefined) as Record<string, unknown>;
    b.set = (v: unknown) => {
      guncellenenler.push(v);
      return b;
    };
    return b;
  }),
  delete: vi.fn(() => sorgu(undefined)),
  transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
    cb({
      execute: vi.fn(async () => {}),
      select: () => sorgu([]),
      insert: () => sorgu([{ id: 'claim-1' }]),
      update: () => sorgu(undefined),
      delete: () => sorgu(undefined),
    }),
  ),
};
vi.mock('@/db/client', () => ({ db: dbSahte }));

const shopifyRest = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({}));
vi.mock('@/lib/shopify/client', () => ({
  shopifyRest: (...a: unknown[]) => shopifyRest(...a),
  shopifyGraphQL: vi.fn(),
}));
const createKargoLabShipment = vi.fn(async (..._a: unknown[]) => ({ ok: false as const, error: 'test: burada dur' }));
vi.mock('@/lib/kargolab/shipments', () => ({
  createKargoLabShipment: (...a: unknown[]) => createKargoLabShipment(...a),
  createKargoLabAddress: vi.fn(),
  listSenderAddresses: vi.fn(async () => []),
}));
const quoteShipmentRate = vi.fn(async (..._a: unknown[]) => ({
  ok: true,
  rates: [{ courrierId: 7, courrierName: 'PTT', priceCents: 10000, acceptsCOD: true, acceptsCODCard: true }],
}));
vi.mock('@/lib/kargolab/rates', () => ({ quoteShipmentRate: (...a: unknown[]) => quoteShipmentRate(...a) }));
vi.mock('@/lib/shopify/fulfillment-push', () => ({ pushFulfillmentToShopify: vi.fn(async () => ({ ok: true })) }));
vi.mock('@/lib/orders/lifecycle', () => ({ notifyNativeOrderShipped: vi.fn(async () => {}) }));
vi.mock('@/lib/server/mikro-sync', () => ({ syncOrderToMikro: vi.fn(async () => {}) }));
vi.mock('@/lib/brand', () => ({ trackingPageUrl: () => 'https://example.test/takip' }));
vi.mock('@/lib/env', () => ({ env: { MIKRO_AUTO_PUSH: false, SHOPIFY_API_VERSION: '2025-01' } }));

const { ilIlceUyumu, trKatla } = await import('@/lib/tr-addresses/il-ilce-uyum');
const { etiketAdresKapisi } = await import('@/lib/server/etiket-adres-kapisi');
const { createFulfillmentForOrderVendor } = await import('@/lib/server/fulfillment-service');

beforeEach(() => {
  kuyruk.length = 0;
  eklenenler.length = 0;
  guncellenenler.length = 0;
  shopifyRest.mockReset();
  createKargoLabShipment.mockClear();
  quoteShipmentRate.mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ilIlceUyumu — ilçe kayıtlı ilin listesinde mi', () => {
  it('Ankara/Erbaa → uyumsuz (#1164)', () => {
    expect(ilIlceUyumu('Ankara', 'Erbaa').durum).toBe('uyumsuz');
  });
  it('Bingöl/Şişli → uyumsuz (#1169)', () => {
    expect(ilIlceUyumu('Bingöl', 'Şişli').durum).toBe('uyumsuz');
  });
  it('Tokat/Erbaa → uyumlu', () => {
    expect(ilIlceUyumu('Tokat', 'Erbaa').durum).toBe('uyumlu');
  });

  it('harf farkları geçer: İ/ı/I, büyük-küçük, aksansız yazım, Shopify ASCII il adı', () => {
    for (const [il, ilce] of [
      ['İstanbul', 'şişli'],
      ['ISTANBUL', 'ŞİŞLİ'],
      ['Istanbul', 'Şişli'], // Shopify siparişte il adını böyle döndürüyor (#1165, #1171)
      ['istanbul', 'SISLI'],
      ['İSTANBUL', 'Kadıköy'],
      ['IĞDIR', 'ARALIK'],
      ['Iğdır', 'aralık'],
      ['ISPARTA', 'EĞİRDİR'],
      ['izmir', 'KARŞIYAKA'],
      ['Kahramanmaraş', 'onikişubat'],
      ['Şanlıurfa', 'Haliliye'],
      ['TR-60', 'Erbaa'], // il alanında kod kalmış eski siparişler (#615)
      ['TR-01', 'Yumurtalık'],
    ] as const) {
      expect(ilIlceUyumu(il, ilce), `${il}/${ilce}`).toMatchObject({ durum: 'uyumlu' });
    }
  });

  it('katlama iki dili de korur (tr yereli I→ı, en yereli İ→i̇ yapıyordu)', () => {
    expect(trKatla('İSTANBUL')).toBe(trKatla('istanbul'));
    expect(trKatla('I')).toBe(trKatla('ı'));
    expect(trKatla('Iğdır')).toBe('igdir');
    expect(trKatla('İ'.toLowerCase())).toBe('i'); // 'i̇' (i + birleşen nokta)
  });

  it('"Merkez" ilçesi olan illerde: Merkez / il adı / "<İl> Merkez" geçer', () => {
    expect(ilIlceUyumu('Tokat', 'Merkez').durum).toBe('uyumlu');
    expect(ilIlceUyumu('Tokat', 'TOKAT').durum).toBe('uyumlu');
    expect(ilIlceUyumu('Tokat', 'Tokat Merkez').durum).toBe('uyumlu');
    expect(ilIlceUyumu('Çorum', 'merkez').durum).toBe('uyumlu');
  });

  it('büyükşehirde ilçe alanına il adı yazılmışsa uyumsuz (#1067 Adana/"Adana")', () => {
    expect(ilIlceUyumu('Adana', 'Adana').durum).toBe('uyumsuz');
    expect(ilIlceUyumu('İstanbul', 'Merkez').durum).toBe('uyumsuz');
  });

  it('il boş ya da tanınmıyorsa doğrulanamadı (bugünkü davranış sürer)', () => {
    expect(ilIlceUyumu(null, 'Çeşme')).toMatchObject({ durum: 'dogrulanamadi', sebep: 'il-yok' });
    expect(ilIlceUyumu('', 'Çeşme')).toMatchObject({ durum: 'dogrulanamadi', sebep: 'il-yok' });
    expect(ilIlceUyumu('Atlantis', 'Çeşme')).toMatchObject({ durum: 'dogrulanamadi', sebep: 'il-tanimsiz' });
    expect(ilIlceUyumu('TR-99', 'Çeşme')).toMatchObject({ durum: 'dogrulanamadi', sebep: 'il-tanimsiz' });
    expect(ilIlceUyumu('Tokat', '')).toMatchObject({ durum: 'dogrulanamadi', sebep: 'ilce-yok' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('etiketAdresKapisi — hata, olay kaydı ve Shopify düzeltmesi', () => {
  function bag(taze: Record<string, string | undefined> | null) {
    return {
      guncelAdresOku: vi.fn(async () => taze),
      adresiKaydet: vi.fn(async () => {}),
      olayYaz: vi.fn(async () => {}),
    };
  }

  it('Ankara/Erbaa, Shopify da hâlâ yanlış → etiket YOK, hata + olay kaydı', async () => {
    const b = bag({ district: 'Ankara', city: 'Erbaa' });
    const r = await etiketAdresKapisi(
      { orderId: 'o1', vendorId: 'v1', shopifyOrderId: '6500', ship: { district: 'Ankara', city: 'Erbaa' } },
      b,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.startsWith('il-ilçe uyumsuz: Ankara/Erbaa')).toBe(true);
    expect(b.olayYaz).toHaveBeenCalledTimes(1);
    expect(b.adresiKaydet).not.toHaveBeenCalled();
  });

  it('Ankara/Erbaa ama operasyon Shopify tarafında Tokat yaptı → güncel adres DB kaydına yazılır, etiket geçer', async () => {
    const b = bag({ district: 'Tokat', city: 'Erbaa', address1: 'x' });
    const r = await etiketAdresKapisi(
      { orderId: 'o1', vendorId: 'v1', shopifyOrderId: '6500', ship: { district: 'Ankara', city: 'Erbaa' } },
      b,
    );
    expect(r).toMatchObject({ ok: true, tazelendi: true, ship: { district: 'Tokat', city: 'Erbaa' } });
    expect(b.adresiKaydet).toHaveBeenCalledWith('o1', { district: 'Tokat', city: 'Erbaa', address1: 'x' });
    expect(b.olayYaz).not.toHaveBeenCalled();
  });

  it('Shopify okunamazsa yine etiket YOK (hata fırlatmaz)', async () => {
    const b = bag(null);
    b.guncelAdresOku.mockRejectedValueOnce(new Error('ağ'));
    const r = await etiketAdresKapisi(
      { orderId: 'o1', vendorId: 'v1', shopifyOrderId: '6500', ship: { district: 'Ankara', city: 'Erbaa' } },
      b,
    );
    expect(r.ok).toBe(false);
  });

  it('Tokat/Erbaa → geçer, Shopify hiç sorulmaz', async () => {
    const b = bag(null);
    const r = await etiketAdresKapisi(
      { orderId: 'o1', vendorId: 'v1', shopifyOrderId: '6500', ship: { district: 'Tokat', city: 'Erbaa' } },
      b,
    );
    expect(r).toMatchObject({ ok: true, tazelendi: false });
    expect(b.guncelAdresOku).not.toHaveBeenCalled();
  });

  it('il boş (eski PayTR siparişleri) → geçer, bugünkü davranış', async () => {
    const b = bag(null);
    const r = await etiketAdresKapisi({ orderId: 'o1', vendorId: 'v1', shopifyOrderId: '6500', ship: { city: 'Çeşme' } }, b);
    expect(r.ok).toBe(true);
    expect(b.guncelAdresOku).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('createFulfillmentForOrderVendor — kapı etiketten ÖNCE', () => {
  function siparisKuyrugu(ship: Record<string, string>) {
    kuyruk.push(
      [], // mevcut fulfillment yok
      [
        {
          id: 'o1',
          orderName: '#9001',
          orderNumber: null,
          shopifyOrderId: '6500',
          shippingAddress: { name: 'Ad Soyad', address1: 'Sokak 1', ...ship },
          customerEmail: 'a@b.c',
          customerPhone: '5551112233',
          customerName: 'Ad Soyad',
          tags: ['kapida-odeme'],
          totalCents: 10000n,
        },
      ],
      [{ id: 'li1', variantId: 'v', title: 'Ürün', sku: '1', quantity: 1, unitPriceCents: 10000n, weightGrams: 500 }],
      [{ id: 'v1', name: 'Via Mood', metadata: { kargolabSenderAddressId: 11 } }], // gönderici adresi hazır
    );
  }

  it('Ankara/Erbaa → etiket YOK: KargoLab hiç çağrılmaz, hata döner', async () => {
    siparisKuyrugu({ district: 'Ankara', city: 'Erbaa' });
    shopifyRest.mockResolvedValueOnce({ order: { shipping_address: { province: 'Ankara', city: 'Erbaa' } } });
    const r = await createFulfillmentForOrderVendor('o1', 'v1', { courrier: 'PTT' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.startsWith('il-ilçe uyumsuz: Ankara/Erbaa')).toBe(true);
    expect(createKargoLabShipment).not.toHaveBeenCalled();
    expect(quoteShipmentRate).not.toHaveBeenCalled();
    // operasyonun gördüğü olay kaydı
    expect(eklenenler).toContainEqual(expect.objectContaining({ orderId: 'o1', eventType: 'etiket_engellendi' }));
  });

  it('Tokat/Erbaa → geçer: KargoLab etiketi istenir', async () => {
    siparisKuyrugu({ district: 'Tokat', city: 'Erbaa' });
    await createFulfillmentForOrderVendor('o1', 'v1', { courrier: 'PTT' });
    expect(createKargoLabShipment).toHaveBeenCalledTimes(1);
    const alici = (createKargoLabShipment.mock.calls[0]![0] as { addresses: { receiver: Record<string, string> } })
      .addresses.receiver;
    expect(alici.state).toBe('Tokat');
    expect(alici.town).toBe('Erbaa');
    expect(shopifyRest).not.toHaveBeenCalled();
  });

  it('"İstanbul"/"şişli" harf farkı → geçer', async () => {
    siparisKuyrugu({ district: 'İstanbul', city: 'şişli' });
    await createFulfillmentForOrderVendor('o1', 'v1', { courrier: 'PTT' });
    expect(createKargoLabShipment).toHaveBeenCalledTimes(1);
  });

  it('Ankara/Erbaa ama Shopify tarafında Tokat/Erbaa olarak düzeltilmiş → güncel adresle etiket kesilir', async () => {
    siparisKuyrugu({ district: 'Ankara', city: 'Erbaa' });
    shopifyRest.mockResolvedValueOnce({
      order: { shipping_address: { name: 'Ad Soyad', address1: 'Sokak 1', province: 'Tokat', city: 'Erbaa' } },
    });
    await createFulfillmentForOrderVendor('o1', 'v1', { courrier: 'PTT' });
    expect(createKargoLabShipment).toHaveBeenCalledTimes(1);
    const alici = (createKargoLabShipment.mock.calls[0]![0] as { addresses: { receiver: Record<string, string> } })
      .addresses.receiver;
    expect(alici.state).toBe('Tokat');
    expect(guncellenenler).toContainEqual(
      expect.objectContaining({ shippingAddress: expect.objectContaining({ district: 'Tokat', city: 'Erbaa' }) }),
    );
  });
});
