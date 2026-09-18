/**
 * 17 Eyl 2026 arızasının regresyon testi.
 *
 * Arıza: banka 3D dönüşü bizim uca BAŞKA origin'den geldiği için önizleme çerezi
 * taşınmıyordu. `cfg()` ortamı YALNIZ o çerezten okuduğu için ortam "bilinmiyor"
 * sayılıyor, baseUrl test adresine düşüyor, TEST kimlik yuvası seçiliyordu.
 * Prod'da test yuvası BOŞ olduğundan `halkodeConfigured()` false dönüyor ve
 * callback ödemeyi "sebep=yapilandirma" diyerek reddediyordu:
 * para çekiliyor, sipariş açılmıyordu.
 *
 * Bu testler ortam seçiminin çerezten BAĞIMSIZ olduğunu çiviler.
 * Çerez hiç okunmadığı için `./preview` burada mock'lanmıyor bile — istek
 * bağlamı yok, `previewOrtami()` zaten null döner. Testin anlamı tam olarak bu:
 * çerez YOKKEN doğru ortam seçilmeli.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** store_settings.payment'ın test başına değiştirilebilir hâli. */
let payment: Record<string, unknown> = {};

vi.mock('@/lib/settings/store', () => ({
  getStoreSettings: async () => ({ payment }),
}));

// client.ts `import('../settings/store')` diyor — aynı modülün göreli yolu.
vi.mock('../src/lib/settings/store', () => ({
  getStoreSettings: async () => ({ payment }),
}));

const { odemeOrtami, halkodeConfigured, halkodeIsLive } = await import('@/lib/halkode/client');

/** Prod'daki gerçek durum: yalnız CANLI yuva dolu, test yuvası hiç yok. */
const PROD_GIBI = {
  halkode_live_app_id: 'x-app-id',
  halkode_live_app_secret: 'x-app-secret',
  halkode_live_merchant_key: '$2y$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
};

beforeEach(() => {
  payment = {};
  delete process.env.HALKODE_BASE_URL;
});

describe('odemeOrtami — ortam çerezten bağımsız belirlenir', () => {
  it('POZİTİF: prod gibi (yalnız canlı yuva dolu) → canlı ortam seçilir', async () => {
    payment = { ...PROD_GIBI };
    expect(await odemeOrtami()).toBe('canli');
  });

  it('POZİTİF: çerez yokken canlı kimlik GÖRÜLÜR — configured true', async () => {
    payment = { ...PROD_GIBI };
    const ortam = await odemeOrtami();
    // Arıza anında bu satır false dönüyordu ve ödeme reddediliyordu.
    expect(await halkodeConfigured(ortam)).toBe(true);
    expect(await halkodeIsLive(ortam)).toBe(true);
  });

  it('NEGATİF: ortam GEÇİRİLMEZSE (eski çerez yolu) canlı kimlik görülmez', async () => {
    payment = { ...PROD_GIBI };
    // Çerez yok + ortam yok → eski davranış: test adresine düşer, test yuvası boş.
    // Bu, düzeltilen arızanın ta kendisi; burada BİLEREK false bekliyoruz ki
    // ortamı taşımayan yeni bir çağrı eklenirse test kırmızıya dönsün.
    expect(await halkodeConfigured()).toBe(false);
  });

  it('test_mode AÇIKÇA 1 ise operatörün test niyeti ezilmez', async () => {
    payment = { ...PROD_GIBI, halkode_test_mode: 1 };
    expect(await odemeOrtami()).toBe('test');
  });

  it('test_mode AÇIKÇA 0 ise canlı — kimlik dolu olmasa bile', async () => {
    payment = { halkode_test_mode: 0 };
    expect(await odemeOrtami()).toBe('canli');
  });

  it('iki yuva da boşsa null döner (yapılandırma eksik denebilsin)', async () => {
    payment = {};
    expect(await odemeOrtami()).toBeNull();
  });

  it('canlı ortamda HALKODE_BASE_URL testapp olsa BİLE canlı adres kullanılır', async () => {
    // Arızanın ikinci halkası: env override'ı çerezsiz yolda baseUrl'i testapp'e
    // çiviliyordu. Ortam açıkça 'canli' ise env bunu artık ezemez.
    process.env.HALKODE_BASE_URL = 'https://testapp.halkode.com.tr/ccpayment';
    payment = { ...PROD_GIBI };
    expect(await halkodeIsLive('canli')).toBe(true);
  });

  it("ortam 'test' zorlandığında canlı kimlik SIZMAZ", async () => {
    payment = { ...PROD_GIBI };
    // Test ortamında canlı kimlik kullanılırsa Halköde status 30 döner ve
    // daha kötüsü: canlı anahtar test trafiğine karışır.
    expect(await halkodeIsLive('test')).toBe(false);
    expect(await halkodeConfigured('test')).toBe(false);
  });
});
