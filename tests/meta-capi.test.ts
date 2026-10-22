/**
 * ÇİVİ — #994827 · META CONVERSIONS API (sunucu Purchase).
 *
 * Dört sözleşme, her birinin NEGATİF bacağı var (kural kalkarsa test KIRILMALI):
 *   A) event_id tema ile BİREBİR — temanın kendi betikleri vm'de koşturulur, sunucu
 *      kimliği onların ürettiği eventID ile karşılaştırılır (elle yazılmış beklenti değil).
 *   B) jeton yokken NO-OP — ağa çıkılmaz, istisna yok, kütüğe tek satır.
 *   C) PII hash'li — gövdede düz e-posta/telefon/ad YOK, kütükte PII ve jeton YOK.
 *   D) hata yolu siparişi bloklamaz — fırlatmaz, sınırlı yeniden dener, arka plan senkron döner.
 * Meta'ya HİÇBİR istek gitmez: fetch her yerde sahte.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

const envSahte = vi.hoisted((): Record<string, string | undefined> => ({
  STOREFRONT_URL: 'https://viamood.com.tr',
  META_PIXEL_ID: '1355197119331444',
  META_GRAPH_VERSION: 'v21.0',
  META_CAPI_TOKEN: undefined,
  META_CAPI_TEST_EVENT_CODE: undefined,
}));
vi.mock('@/lib/env', () => ({ env: envSahte }));

import {
  PURCHASE_OLAY_ONEKI,
  purchaseGonder,
  purchaseOlayi,
  purchaseOlayKimligi,
  telefonNormal,
  temaSiparisNo,
  type PurchaseGirdi,
} from '@/lib/meta/capi';
import { capiAyar, govdedenGirdi, istemciBilgisi, metaPurchaseArkaPlanda, nativeGirdi, taslaktanGirdi } from '@/lib/meta/capi-bagla';

const KOK = join(__dirname, '..');
const oku = (p: string) => readFileSync(join(KOK, p), 'utf8');
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

// Gerçek görünümlü ama UYDURMA müşteri — PII sızıntısını aramak için işaretli dizgeler.
const EPOSTA = 'Ayse.Yilmaz+capi@Ornek.com';
const TELEFON = '0532 111 22 33';
const AD = 'Ayşe';
const SOYAD = 'Yılmaz';
const JETON = 'EAAtestJETONdegeri_SIZMAMALI_123';
const girdi = (ek: Partial<PurchaseGirdi> = {}): PurchaseGirdi => ({
  siparisNo: '1032',
  deger: 1300.5,
  eposta: EPOSTA,
  telefon: TELEFON,
  ad: AD,
  soyad: SOYAD,
  sehir: 'İstanbul',
  postaKodu: '34710',
  istemciIp: '203.0.113.7',
  tarayici: 'Mozilla/5.0 test',
  kaynakUrl: 'https://viamood.com.tr/pages/siparis-alindi',
  ...ek,
});
const yanit = (status: number, govde: unknown = { events_received: 1 }) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => govde }) as unknown as Response;

// ── Tema betiği: sipariş-alındı (Purchase) ────────────────────────────────────
const BASARI = oku('tema-yamalari/via-order-success.liquid.994753-META-PURCHASE');
const BASARI_BETIK = (BASARI.match(/<script>([\s\S]*?)<\/script>/) ?? [])[1] ?? '';

/** Temanın Purchase betiğini `?order=<no>&total=…` ile koşturur, eventID'yi döndürür. */
function temaEventId(order: string): string | undefined {
  const cagrilar: Array<Record<string, unknown> | undefined> = [];
  const window: Record<string, unknown> = {
    fbq: (_k: string, olay: string, _y: unknown, secenek?: Record<string, unknown>) => {
      if (olay === 'Purchase') cagrilar.push(secenek);
    },
  };
  const depo = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
  const qs = `?order=${encodeURIComponent(order)}&total=100`;
  window.location = { search: qs };
  const ctx = vm.createContext({
    window, URLSearchParams, location: { search: qs },
    document: { querySelector: () => null, querySelectorAll: () => [], body: {} },
    sessionStorage: depo(), localStorage: depo(),
    fetch: () => new Promise(() => {}), setTimeout: () => 0, navigator: {},
  });
  vm.runInContext(BASARI_BETIK.replace(/window\.location\.search/g, 'location.search'), ctx);
  return cagrilar[0]?.eventID as string | undefined;
}

// ── Tema betiği: ödeme sayfası (havale/kapıda → başarı sayfasına yönlendirme) ──
const CHECKOUTLAR = readdirSync(join(KOK, 'tema-yamalari'))
  .filter((f) => f.startsWith('via-checkout.liquid'))
  .map((f) => ({ ad: f, kaynak: oku(`tema-yamalari/${f}`) }))
  .filter((c) => c.kaynak.includes('function vmTesekkureGit'));

/** Temanın `vmTesekkureGit(d)` fonksiyonunu koşturur, yönlendirdiği URL'deki `order`ı döndürür. */
function temaYonlendirmeOrder(kaynak: string, d: Record<string, unknown>): string | null {
  const bas = kaynak.indexOf('function vmTesekkureGit');
  const son = kaynak.indexOf('\n  }\n', bas);
  const fn = kaynak.slice(bas, son + 4);
  let gidilen = '';
  const ctx = vm.createContext({
    $: () => null, sessionStorage: { setItem: () => {} }, JSON,
    window: { location: { replace: (u: string) => { gidilen = u; } } },
    encodeURIComponent, String, Date,
  });
  vm.runInContext(`${fn}\nvmTesekkureGit(${JSON.stringify(d)}, 'havale');`, ctx);
  return new URLSearchParams(gidilen.split('?')[1] ?? '').get('order');
}

afterEach(() => {
  vi.restoreAllMocks();
  envSahte.META_CAPI_TOKEN = undefined;
  envSahte.META_CAPI_TEST_EVENT_CODE = undefined;
});

describe('A · event_id — tema sözleşmesiyle BİREBİR', () => {
  it('tema betikleri bulundu (çivi boşa koşmuyor)', () => {
    expect(BASARI_BETIK).toContain("eventID: 'via-pur-' + String(no)");
    expect(CHECKOUTLAR.length).toBeGreaterThan(0);
  });

  it.each(['1032', '1068', '4512398765432', 'VM-100002'])('order=%s → sunucu event_id = temanın eventID’si', (no) => {
    expect(temaEventId(no)).toBe(`via-pur-${no}`);
    expect(purchaseOlayKimligi(no)).toBe(temaEventId(no));
    expect(PURCHASE_OLAY_ONEKI).toBe('via-pur-');
  });

  it('havale/kapıda: temaSiparisNo, temanın yönlendirdiği `order` ile aynı (her checkout sürümünde)', () => {
    for (const c of CHECKOUTLAR) {
      for (const d of [{ order_code: '#1032', total: 10 }, { order_name: '#1044' }, { order_code: 'VM-100002' }]) {
        const temaOrder = temaYonlendirmeOrder(c.kaynak, d);
        expect(temaSiparisNo((d as any).order_code || (d as any).order_name), c.ad).toBe(temaOrder);
        // uçtan uca: sunucu olayının event_id'si = tema Purchase'ının eventID'si
        const g = govdedenGirdi({ email: EPOSTA, phone: TELEFON }, { orderName: String((d as any).order_code || (d as any).order_name), total: 10 })!;
        expect(purchaseOlayi(g)!.event_id).toBe(temaEventId(temaOrder!));
      }
    }
  });

  it('kart: taslaktanGirdi siparisNo = draftId → event_id = temanın eventID’si (sipariş ADI değil)', () => {
    const j = { draft_order: { email: EPOSTA, total_price: '1300.50', currency: 'TRY', order_id: 99, name: '#D883' } };
    const g = taslaktanGirdi(j, '1234567890123')!;
    expect(purchaseOlayi(g)!.event_id).toBe(temaEventId('1234567890123'));
    expect(purchaseOlayi(g)!.event_id).not.toContain('D883');
  });

  it('native kart: numericRef → event_id = temanın eventID’si', () => {
    const g = nativeGirdi({ numericRef: '100002', totalCents: 130050n, email: EPOSTA, name: 'Ayşe Yılmaz' })!;
    expect(purchaseOlayi(g)!.event_id).toBe(temaEventId('100002'));
    expect(g.deger).toBe(1300.5);
  });

  it('callback’ler CAPI’ye, başarı sayfasına `order` olarak yazdıkları AYNI draftId’yi veriyor', () => {
    for (const [ad, kaynak] of [
      ['halkode', oku('src/app/api/v1/payment/halkode/callback/route.ts')],
      ['iyzico', oku('src/app/api/v1/payment/iyzico/callback/route.ts')],
      ['paytr', oku('src/app/api/v1/payment/paytr/callback/route.ts')],
    ] as const) {
      expect(kaynak, ad).toMatch(/metaPurchaseArkaPlanda\(taslaktanGirdi\(j, draftId(, istemci)?\)\)/);
    }
    expect(oku('src/app/api/v1/payment/halkode/callback/route.ts')).toContain("q.set('order', draftId)");
    expect(oku('src/app/api/v1/payment/iyzico/callback/route.ts')).toContain('&order=${encodeURIComponent(draftId)}');
    expect(oku('src/app/api/v1/payment/paytr/initialize/route.ts')).toContain("'&order=' + draftId");
    for (const yol of ['havale', 'cod']) {
      const k = oku(`src/app/api/v1/payment/${yol}/create/route.ts`);
      expect(k, yol).toContain('metaPurchaseArkaPlanda(govdedenGirdi(body, created, istemciBilgisi(req.headers)))');
      expect(k, yol).toContain('order_code: created.orderName');
    }
    expect(oku('src/lib/store/native-create-order.ts')).toMatch(/metaPurchaseArkaPlanda\(\s*nativeGirdi\(\{ numericRef,/);
  });
});

describe('B · jeton yokken SESSİZ NO-OP', () => {
  it.each([undefined, null, '', '   '])('jeton=%j → ağa çıkılmaz, atlandı, tek kütük satırı', async (jeton) => {
    const fetchFn = vi.fn();
    const satirlar: string[] = [];
    const s = await purchaseGonder(girdi(), { jeton }, { fetchFn: fetchFn as any, kutuk: (x) => satirlar.push(x) });
    expect(s).toEqual({ durum: 'atlandi', sebep: 'jeton-yok', eventId: 'via-pur-1032' });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(satirlar).toHaveLength(1);
    expect(satirlar[0]).toContain('capi atlandı: jeton yok');
  });

  it('arka plan sarmalayıcı (env’de jeton yok): senkron döner, fırlatmaz, global fetch ÇAĞRILMAZ', async () => {
    const fetchCasus = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('ağa çıkılmamalıydı'); });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(capiAyar().jeton).toBeUndefined();
    expect(metaPurchaseArkaPlanda(girdi())).toBeUndefined();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchCasus).not.toHaveBeenCalled();
    expect(log.mock.calls.map((c) => String(c[0]))).toEqual(['[meta-capi] capi atlandı: jeton yok event_id=via-pur-1032']);
  });

  it('NEGATİF: jeton VARSA ağa çıkılır (NO-OP kalıcı değil — jeton gelince iş iner)', async () => {
    const fetchFn = vi.fn(async () => yanit(200));
    const s = await purchaseGonder(girdi(), { jeton: JETON }, { fetchFn: fetchFn as any, kutuk: () => {} });
    expect(s.durum).toBe('gonderildi');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v21.0/1355197119331444/events');
    const govde = JSON.parse(String(init.body));
    expect(govde.data[0]).toMatchObject({ event_name: 'Purchase', action_source: 'website', event_id: 'via-pur-1032', custom_data: { value: 1300.5, currency: 'TRY', order_id: '1032' } });
    expect(typeof govde.data[0].event_time).toBe('number');
  });

  it('test_event_code YALNIZ ayarda varsa gönderilir', async () => {
    const fetchFn = vi.fn(async () => yanit(200));
    await purchaseGonder(girdi(), { jeton: JETON }, { fetchFn: fetchFn as any, kutuk: () => {} });
    await purchaseGonder(girdi(), { jeton: JETON, testOlayKodu: 'TEST123' }, { fetchFn: fetchFn as any, kutuk: () => {} });
    const g = fetchFn.mock.calls.map((c: any) => JSON.parse(String(c[1].body)));
    expect('test_event_code' in g[0]).toBe(false);
    expect(g[1].test_event_code).toBe('TEST123');
  });

  it('değer 0/geçersiz → gönderilmez (tema da göndermiyor)', async () => {
    const fetchFn = vi.fn(async () => yanit(200));
    for (const deger of [0, -5, 'abc', '']) {
      const s = await purchaseGonder(girdi({ deger }), { jeton: JETON }, { fetchFn: fetchFn as any, kutuk: () => {} });
      expect(s).toMatchObject({ durum: 'atlandi', sebep: 'gecersiz-girdi' });
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('C · PII hash’li, loga düşmez; jeton sızmaz', () => {
  const ham = [EPOSTA, EPOSTA.toLowerCase(), 'ayse.yilmaz', '0532', '5321112233', '905321112233', AD, SOYAD, 'ayşe', 'yılmaz'];

  it('gövdede düz PII YOK; em/ph/fn/ln Meta normalizasyonuyla SHA-256', async () => {
    const fetchFn = vi.fn(async () => yanit(200));
    await purchaseGonder(girdi(), { jeton: JETON }, { fetchFn: fetchFn as any, kutuk: () => {} });
    const govdeMetni = String((fetchFn.mock.calls[0] as any)[1].body);
    for (const h of ham) expect(govdeMetni.toLowerCase(), h).not.toContain(h.toLowerCase());
    const ud = JSON.parse(govdeMetni).data[0].user_data;
    expect(ud.em).toEqual([sha('ayse.yilmaz+capi@ornek.com')]);
    expect(ud.ph).toEqual([sha('905321112233')]);
    expect(ud.fn).toEqual([sha('ayşe')]);
    expect(ud.ln).toEqual([sha('yılmaz')]);
    expect(ud.ct).toEqual([sha('istanbul')]);
    expect(ud.country).toEqual([sha('tr')]);
  });

  it('jeton URL’de değil gövdede (URL loglansa sızmaz)', async () => {
    const fetchFn = vi.fn(async () => yanit(200));
    await purchaseGonder(girdi(), { jeton: JETON }, { fetchFn: fetchFn as any, kutuk: () => {} });
    expect(String((fetchFn.mock.calls[0] as any)[0])).not.toContain(JETON);
  });

  it('TÜM yollarda kütük satırlarında PII ve jeton YOK (başarı · 400 · 500 · ağ hatası · jetonsuz)', async () => {
    const satirlar: string[] = [];
    const kutuk = (x: string) => satirlar.push(x);
    const b = { kutuk, bekle: async () => {} };
    await purchaseGonder(girdi(), { jeton: JETON }, { ...b, fetchFn: (async () => yanit(200)) as any });
    await purchaseGonder(girdi(), { jeton: JETON }, { ...b, fetchFn: (async () => yanit(400, { error: { message: `bad ${EPOSTA}` } })) as any });
    await purchaseGonder(girdi(), { jeton: JETON }, { ...b, fetchFn: (async () => yanit(500)) as any });
    await purchaseGonder(girdi(), { jeton: JETON }, { ...b, fetchFn: (async () => { throw new Error(`ECONNRESET ${EPOSTA} ${JETON}`); }) as any });
    await purchaseGonder(girdi(), {}, b);
    expect(satirlar.length).toBeGreaterThanOrEqual(7);
    const hepsi = satirlar.join('\n').toLowerCase();
    for (const h of [...ham, JETON, '203.0.113.7', 'mozilla']) expect(hepsi, h).not.toContain(h.toLowerCase());
  });

  it('telefon TR biçimleri tek kanonik biçime iner', () => {
    for (const t of ['05321112233', '5321112233', '+90 532 111 22 33', '0090 532 111 2233', '90-532-111-22-33']) expect(telefonNormal(t), t).toBe('905321112233');
    expect(telefonNormal('123')).toBeNull();
  });

  it('istemciBilgisi: x-forwarded-for’un İLK adresi + UA', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'user-agent': 'UA' });
    expect(istemciBilgisi(h)).toEqual({ istemciIp: '203.0.113.7', tarayici: 'UA' });
  });
});

describe('D · hata yolu siparişi BLOKLAMAZ', () => {
  it('ağ hatası → fırlatmaz, 3 deneme, sonra bırakır', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('ECONNRESET'); });
    const bekle = vi.fn(async () => {});
    const s = await purchaseGonder(girdi(), { jeton: JETON }, { fetchFn: fetchFn as any, bekle, kutuk: () => {} });
    expect(s).toMatchObject({ durum: 'hata', deneme: 3, sebep: 'ag-hatasi' });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(bekle.mock.calls.map((c: any) => c[0])).toEqual([500, 1500]);
  });

  it('5xx/429 yeniden denenir; ikinci denemede 200 → gönderildi', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(yanit(503)).mockResolvedValueOnce(yanit(200));
    const s = await purchaseGonder(girdi(), { jeton: JETON }, { fetchFn: fetchFn as any, bekle: async () => {}, kutuk: () => {} });
    expect(s).toMatchObject({ durum: 'gonderildi', deneme: 2 });
    const f429 = vi.fn().mockResolvedValueOnce(yanit(429)).mockResolvedValueOnce(yanit(200));
    expect((await purchaseGonder(girdi(), { jeton: JETON }, { fetchFn: f429 as any, bekle: async () => {}, kutuk: () => {} })).durum).toBe('gonderildi');
  });

  it('4xx (geçersiz jeton vb.) YENİDEN DENENMEZ — aynı sonucu verir', async () => {
    const fetchFn = vi.fn(async () => yanit(400));
    const s = await purchaseGonder(girdi(), { jeton: JETON }, { fetchFn: fetchFn as any, bekle: async () => {}, kutuk: () => {} });
    expect(s).toMatchObject({ durum: 'hata', httpKodu: 400, deneme: 1 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('asılı kalan istek zaman aşımıyla kesilir (sipariş akışı beklemez)', async () => {
    const fetchFn = vi.fn((_u: string, init: RequestInit) => new Promise((_r, rej) => {
      init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const s = await purchaseGonder(girdi(), { jeton: JETON }, { fetchFn: fetchFn as any, zamanAsimiMs: 5, enCokDeneme: 1, kutuk: () => {} });
    expect(s).toMatchObject({ durum: 'hata', sebep: 'zaman-asimi' });
  });

  it('kütük bile patlasa fırlatmaz', async () => {
    const s = await purchaseGonder(girdi(), { jeton: JETON }, { fetchFn: (async () => yanit(200)) as any, kutuk: () => { throw new Error('disk dolu'); } });
    expect(s.durum).toBe('hata');
  });

  it('arka plan sarmalayıcı: jeton VAR + fetch ASILI → yine senkron döner, fırlatmaz', () => {
    envSahte.META_CAPI_TOKEN = JETON;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
    const t0 = Date.now();
    expect(() => metaPurchaseArkaPlanda(girdi())).not.toThrow();
    expect(Date.now() - t0).toBeLessThan(50);
    expect(() => metaPurchaseArkaPlanda(null)).not.toThrow();
    expect(() => metaPurchaseArkaPlanda({ siparisNo: undefined as any, deger: 'x' })).not.toThrow();
  });

  it('callback’lerde CAPI çağrısı sipariş tamamlama SONUCUNU beklemez (`.then` içinde, `await` yok)', () => {
    for (const yol of ['halkode', 'iyzico', 'paytr']) {
      const k = oku(`src/app/api/v1/payment/${yol}/callback/route.ts`);
      expect(k, yol).not.toMatch(/await\s+metaPurchase/);
      expect(k, yol).toMatch(/resp\.ok\) \{\s*resp\s*\.json\(\)\s*\.then\(\(j\) => \{[\s\S]*?metaPurchaseArkaPlanda[\s\S]*?\.catch\(\(\) => \{\}\);/);
    }
    for (const yol of ['havale', 'cod']) expect(oku(`src/app/api/v1/payment/${yol}/create/route.ts`), yol).not.toMatch(/await\s+metaPurchase/);
  });
});
