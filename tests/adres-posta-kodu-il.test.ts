/**
 * #1164 / #1169 — posta kodu Shopify'da İLİ değiştiriyordu.
 *
 * ARKA PLAN (21 Eyl 2026, canlı Shopify salt okur ölçümü):
 *   - #1164: Tokat/Erbaa seçildi, posta kodu "060"   → Shopify: Ankara (TR-06)
 *   - #1169: İstanbul/Şişli seçildi, posta kodu "12345" → Shopify: Bingöl (TR-12)
 * Shopify ili posta kodunun ilk iki hanesinden (plaka) yeniden yazıyor; etiket de
 * o ille basılıyordu. Kural: posta kodu YALNIZ 5 haneliyse VE ilk iki hanesi seçilen
 * ilin plakasıysa gönderilir, değilse BOŞ gider.
 *
 * Bu dosya üç şeyi çiviler:
 *   1) yardımcının kuralı (postaKodunuSuz / shopifyAdresiKur)
 *   2) dört ödeme yolunun da ortak yardımcıyı kullandığı (kopya geri dönmesin)
 *   3) sipariş oluşunca Shopify ili değiştirdiyse 'adres-uyusmaz' etiketi eklendiği
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const shopifyGraphQL = vi.fn(async (..._a: unknown[]) => ({ tagsAdd: { userErrors: [] } }));
const shopifyRest = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({}));
vi.mock('@/lib/shopify/client', () => ({
  shopifyGraphQL: (...a: unknown[]) => shopifyGraphQL(...a),
  shopifyRest: (...a: unknown[]) => shopifyRest(...a),
}));
vi.mock('@/lib/env', () => ({
  env: {
    SHOPIFY_ADMIN_ACCESS_TOKEN: 'test-token',
    SHOPIFY_STORE_DOMAIN: 'test.myshopify.com',
    SHOPIFY_API_VERSION: '2025-01',
  },
}));
const upsertCustomerAddress = vi.fn(async (..._a: unknown[]) => {});
vi.mock('@/lib/shopify/customer-address', () => ({
  upsertCustomerAddress: (...a: unknown[]) => upsertCustomerAddress(...a),
}));
vi.mock('@/lib/shopify/customer-locale', () => ({ ensureTrCustomer: vi.fn(async () => {}) }));
vi.mock('@/lib/shopify/vendor-ibans', () => ({ resolveVendorIbans: vi.fn(async () => []) }));
vi.mock('@/lib/email/sender', () => ({ sendEmail: vi.fn(async () => {}) }));
vi.mock('@/lib/email/templates', () => ({
  orderConfirmationEmail: vi.fn(() => ({ subject: '', html: '', text: '' })),
}));

const { postaKodunuSuz, shopifyAdresiKur } = await import('@/lib/shopify/adres');
const { ilKoduUyusmazMi, taslakTamamlanincaIlDenetle, ADRES_UYUSMAZ_ETIKETI } = await import(
  '@/lib/shopify/adres-uyusmaz'
);
const { createStorefrontOrder } = await import('@/lib/shopify/create-storefront-order');

const temelAdres = {
  first_name: 'Ad',
  last_name: 'Soyad',
  address1: 'Sokak 1 No 2',
  address2: 'Mahalle',
};

/** Mikro görevleri (beklenmeyen etiket çağrısı) bitsin. */
const bosalt = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  shopifyGraphQL.mockClear();
  shopifyRest.mockReset();
  upsertCustomerAddress.mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('1) posta kodu kuralı — yalnız 5 hane VE plaka = seçilen il', () => {
  it('Tokat/Erbaa/"060" → posta kodu BOŞ (#1164)', () => {
    const a = shopifyAdresiKur({ ...temelAdres, province: 'Tokat', city: 'Erbaa', zip: '060' }, null);
    expect(a.zip).toBe('');
    expect(a.adres.zip).toBe('');
    // il, il kodu ve ilçe bugünkü gibi gider
    expect(a.adres.province).toBe('Tokat');
    expect(a.adres.province_code).toBe('TR-60');
    expect(a.adres.city).toBe('Erbaa');
  });

  it('İstanbul/Şişli/"12345" → posta kodu BOŞ (#1169)', () => {
    const a = shopifyAdresiKur({ ...temelAdres, province: 'İstanbul', city: 'Şişli', zip: '12345' }, null);
    expect(a.zip).toBe('');
    expect(a.adres.zip).toBe('');
    expect(a.adres.province).toBe('İstanbul');
    expect(a.adres.province_code).toBe('TR-34');
  });

  it('İstanbul/Şişli/"34381" → posta kodu KORUNUR', () => {
    const a = shopifyAdresiKur({ ...temelAdres, province: 'İstanbul', city: 'Şişli', zip: '34381' }, null);
    expect(a.zip).toBe('34381');
    expect(a.adres.zip).toBe('34381');
  });

  it('boş posta kodu → boş', () => {
    expect(shopifyAdresiKur({ ...temelAdres, province: 'Tokat', city: 'Erbaa', zip: '' }, null).adres.zip).toBe('');
    expect(shopifyAdresiKur({ ...temelAdres, province: 'Tokat', city: 'Erbaa' }, null).adres.zip).toBe('');
  });

  it('kenar hâller: 4/6 hane, harf, boşluk, il kodu girdisi, tanınmayan il', () => {
    expect(postaKodunuSuz('3438', 'TR-34')).toBe('');
    expect(postaKodunuSuz('343810', 'TR-34')).toBe('');
    expect(postaKodunuSuz('34a81', 'TR-34')).toBe('');
    expect(postaKodunuSuz(' 34381 ', 'TR-34')).toBe('34381');
    expect(postaKodunuSuz('05303401531', 'TR-33')).toBe(''); // #D880: telefon numarası yazılmış
    expect(postaKodunuSuz('6', 'TR-21')).toBe(''); // #D884
    expect(postaKodunuSuz('34381', null)).toBe(''); // il tanınmadıysa kıyas yapılamaz
    // form il alanında KOD gönderse de (#615) plaka kıyası çalışır
    const a = shopifyAdresiKur({ ...temelAdres, province: 'TR-60', city: 'Erbaa', zip: '60600' }, null);
    expect(a.adres.province).toBe('Tokat');
    expect(a.zip).toBe('60600');
  });

  it('telefon: null → alan hiç gönderilmez; dize → olduğu gibi (kart yolları boş dize gönderiyordu)', () => {
    const yok = shopifyAdresiKur({ ...temelAdres, province: 'Tokat', city: 'Erbaa' }, null);
    expect('phone' in yok.adres).toBe(false);
    const bos = shopifyAdresiKur({ ...temelAdres, province: 'Tokat', city: 'Erbaa' }, '');
    expect(bos.adres.phone).toBe('');
    const dolu = shopifyAdresiKur({ ...temelAdres, province: 'Tokat', city: 'Erbaa' }, '+905551112233');
    expect(dolu.adres.phone).toBe('+905551112233');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('2) dört yol da ortak yardımcıyı kullanır — kopya geri dönmesin', () => {
  const kok = path.resolve(__dirname, '..');
  const YOLLAR = [
    'src/lib/shopify/create-storefront-order.ts',
    'src/app/api/v1/payment/paytr/initialize/route.ts',
    'src/app/api/v1/payment/halkode/initialize/route.ts',
    'src/app/api/v1/payment/iyzico/initialize/route.ts',
  ];
  /** Yorumlar ölçüme karışmasın (CLAUDE.md §3c-ter: yorum = fosil kayıt). */
  const kod = (p: string) =>
    readFileSync(path.join(kok, p), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  for (const p of YOLLAR) {
    it(`${p}`, () => {
      const s = kod(p);
      expect(s).toMatch(/shopifyAdresiKur\(/);
      // ham posta kodu Shopify'a (sipariş/taslak adresi ya da adres defteri) gitmesin
      expect(s).not.toMatch(/zip:\s*(b|body)\.zip/);
      // il kodu adres için elle kurulmasın
      expect(s).not.toMatch(/provinceCode\(/);
      expect(s).not.toMatch(/country_code:\s*'TR'/);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('3) Shopify ili değiştirdiyse adres-uyusmaz etiketi', () => {
  it('karşılaştırma kuralı', () => {
    expect(ilKoduUyusmazMi('TR-60', 'TR-06')).toBe(true);
    expect(ilKoduUyusmazMi('TR-34', 'TR-34')).toBe(false);
    expect(ilKoduUyusmazMi('TR-34', 'tr-34')).toBe(false);
    expect(ilKoduUyusmazMi('TR-35', null)).toBe(true); // il tamamen düştü (#1168)
    expect(ilKoduUyusmazMi(null, 'TR-06')).toBe(false); // biz kod göndermediysek kıyas yok
  });

  function shopifyYaniti(provinceCode: string | null) {
    return vi.fn(async (_u: unknown, _i?: unknown) =>
      new Response(
        JSON.stringify({
          order: {
            id: 6500000000001,
            name: '#9001',
            total_price: '100.00',
            shipping_address: { province: provinceCode ? 'x' : null, province_code: provinceCode },
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  const siparis = {
    line_items: [{ variant_id: 1, quantity: 1 }],
    first_name: 'Nesrin',
    last_name: 'Test',
    phone: '05551112233',
    email: 'test@example.com',
    address1: 'Sokak 1 No 2',
    address2: 'Mahalle',
    city: 'Erbaa',
    province: 'Tokat',
    zip: '060',
  };

  it('kapıda ödeme: #1164 akışı — posta kodu boş gider; Shopify yine de değiştirirse etiketlenir', async () => {
    const fetchSahte = shopifyYaniti('TR-06');
    vi.stubGlobal('fetch', fetchSahte);
    try {
      const r = await createStorefrontOrder(siparis, 'cod');
      expect(r.ok).toBe(true);
      const gonderilen = JSON.parse(String((fetchSahte.mock.calls[0]![1] as RequestInit).body)).order;
      expect(gonderilen.shipping_address.zip).toBe('');
      expect(gonderilen.billing_address.zip).toBe('');
      expect(gonderilen.shipping_address.province).toBe('Tokat');
      expect(gonderilen.shipping_address.province_code).toBe('TR-60');
      expect(gonderilen.shipping_address.city).toBe('Erbaa');
      // adres defterine de süzülmüş posta kodu yazılır
      expect((upsertCustomerAddress.mock.calls[0]![0] as { zip: string }).zip).toBe('');
      await bosalt();
      expect(shopifyGraphQL).toHaveBeenCalledTimes(1);
      const degiskenler = shopifyGraphQL.mock.calls[0]![1] as { id: string; tags: string[] };
      expect(degiskenler.id).toBe('gid://shopify/Order/6500000000001');
      expect(degiskenler.tags).toEqual([ADRES_UYUSMAZ_ETIKETI]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('kapıda ödeme: Shopify ili korursa etiket EKLENMEZ', async () => {
    vi.stubGlobal('fetch', shopifyYaniti('TR-60'));
    try {
      const r = await createStorefrontOrder(siparis, 'cod');
      expect(r.ok).toBe(true);
      await bosalt();
      expect(shopifyGraphQL).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('kart: taslak tamamlanınca il değiştiyse etiketlenir', async () => {
    shopifyRest.mockResolvedValueOnce({ order: { name: '#9002', shipping_address: { province: 'Ankara', province_code: 'TR-06' } } });
    await taslakTamamlanincaIlDenetle(
      { draft_order: { order_id: 6500000000002, shipping_address: { province: 'Tokat', province_code: 'TR-60' } } },
      'paytr',
    );
    expect(shopifyRest).toHaveBeenCalledWith('/orders/6500000000002.json?fields=name,shipping_address');
    expect(shopifyGraphQL).toHaveBeenCalledTimes(1);
  });

  it('kart: İstanbul taslağında Shopify il kodunu boş bırakır — sipariş TR-34 ise SAHTE uyuşmaz yok', async () => {
    // ölçüldü: #D883/#D891 'İstanbul' + province_code null; #1165/#1171 siparişte Istanbul/TR-34
    shopifyRest.mockResolvedValueOnce({ order: { name: '#1171', shipping_address: { province: 'Istanbul', province_code: 'TR-34' } } });
    await taslakTamamlanincaIlDenetle(
      { draft_order: { order_id: 6517019312260, shipping_address: { province: 'İstanbul', province_code: null } } },
      'halkode',
    );
    expect(shopifyGraphQL).not.toHaveBeenCalled();
  });

  it('kart: il tamamen düştüyse (#1168 İzmir, posta kodu boş) etiketlenir', async () => {
    shopifyRest.mockResolvedValueOnce({ order: { name: '#1168', shipping_address: { province: null, province_code: null } } });
    await taslakTamamlanincaIlDenetle(
      { draft_order: { order_id: 6509959479428, shipping_address: { province: 'İzmir', province_code: null } } },
      'paytr',
    );
    expect(shopifyGraphQL).toHaveBeenCalledTimes(1);
  });

  it('kart: yanıt beklenmedik biçimdeyse sessizce çıkar, hata FIRLATMAZ', async () => {
    await expect(taslakTamamlanincaIlDenetle(null, 'paytr')).resolves.toBeUndefined();
    await expect(taslakTamamlanincaIlDenetle({ draft_order: {} }, 'paytr')).resolves.toBeUndefined();
    shopifyRest.mockRejectedValueOnce(new Error('ağ'));
    await expect(
      taslakTamamlanincaIlDenetle({ draft_order: { order_id: 1, shipping_address: { province: 'Tokat' } } }, 'paytr'),
    ).resolves.toBeUndefined();
    expect(shopifyGraphQL).not.toHaveBeenCalled();
  });
});
