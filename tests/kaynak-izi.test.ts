/**
 * #994887 · SİPARİŞ TRAFİK KAYNAĞI ÇİVİSİ — UTM/yönlendiren siparişe düşmezse bu dosya KIRILIR.
 *
 * ÖLÇÜLEN ARIZA (22 Eki 2026, Elif): Yunus 10 Eki'den beri "Shopify'da Kanal alanı gerçek
 * trafik kaynağını göstermiyor" diyordu. Ölçüm: tema hiçbir sayfada UTM/yönlendiren
 * yakalamıyordu, ödeme gövdesinde kaynak alanı yoktu, beş sipariş yolunun hiçbiri
 * note_attributes'a kaynak yazmıyordu. "Kanal"da yalnız siparişi açan uygulamanın adı vardı.
 *
 * Dört zorunlu durum (görev maddesi 4) ayrı testlerdir:
 *   1) UTM yok  2) bozuk/eksik parametre  3) yönlendiren boş  4) aynı oturumda ikinci ziyaret
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import {
  kaynakEtiketi,
  kaynakNitelikleri,
  kaynakSuz,
  taslakKaynakAlanlari,
  yonlendirenKaynagi,
} from '../src/lib/kaynak/kaynak-izi';

const KOK = path.resolve(__dirname, '..');
const JS = readFileSync(path.join(KOK, 'tema-yamalari/994887-kaynak-izi/via-kaynak-izi.js'), 'utf8');

/** Bellek içi Storage — tarayıcıdaki localStorage/sessionStorage'ın asgari karşılığı. */
function depo() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

type Dokunus = Record<string, string>;
type Kayit = { ilk: Dokunus | null; son: Dokunus | null };

/**
 * Bir "sayfa görüntülemesi": tema betiğini gerçek bir sayfa gibi baştan çalıştırır.
 * `yerel` cihaz boyunca, `oturum` sekme boyunca yaşar — ikisi test arasında elle taşınır.
 */
function sayfa(url: string, referrer: string, yerel = depo(), oturum = depo()) {
  const u = new URL(url);
  const w: Record<string, unknown> = {
    location: { search: u.search, pathname: u.pathname, hostname: u.hostname },
    document: { referrer },
    localStorage: yerel,
    sessionStorage: oturum,
  };
  vm.runInNewContext(JS, { window: w, Date, JSON, String, decodeURIComponent });
  const kayit = (w.viaKaynak as { oku: () => Kayit }).oku();
  return { kayit, yerel, oturum };
}

describe('tema yakalayıcı (via-kaynak-izi.js) — dört zorunlu durum', () => {
  it('1) UTM YOK, yönlendiren yok: doğrudan giriş — ilk = son, kaynak alanları boş, giriş yolu var', () => {
    const { kayit } = sayfa('https://viamood.com.tr/products/elbise', '');
    expect(kayit.ilk).toBeTruthy();
    expect(kayit.son).toEqual(kayit.ilk);
    expect(kayit.ilk!.kaynak).toBe('');
    expect(kayit.ilk!.yonlendiren).toBe('');
    expect(kayit.ilk!.giris).toBe('/products/elbise');
    // sunucu bunu "(direkt)" diye okur ve etiketler
    const k = kaynakSuz(kayit)!;
    expect(k.ilk!.kaynak).toBe('(direkt)');
    expect(kaynakEtiketi(k)).toBe('kaynak-direkt');
  });

  it('2) BOZUK/EKSİK parametre: boş utm_source, kırık % kodlaması, HTML enjeksiyonu — çökmez, sızdırmaz', () => {
    const { kayit } = sayfa(
      'https://viamood.com.tr/?utm_source=&utm_medium=CPC&utm_campaign=%E0%A4%A&utm_content=%3Cscript%3Ealert(1)%3C/script%3E&utm_term',
      '',
    );
    const d = kayit.ilk!;
    expect(d.kaynak, 'boş utm_source kaynak sayılmamalı').toBe('');
    expect(d.ortam, 'medium küçük harfe normalleşir').toBe('cpc');
    expect(d.kampanya).not.toMatch(/%/);
    expect(d.icerik).not.toMatch(/[<>]/);
    expect(d.terim).toBe('');
    // kaynak adı yok ama UTM izi var → sunucu "(belirtilmemiş)" der, direkt DEMEZ
    const k = kaynakSuz(kayit)!;
    expect(k.ilk!.kaynak).toBe('(belirtilmemiş)');
    expect(k.ilk!.ortam).toBe('cpc');

    // Yalnız BOŞ UTM'li bir bağlantı (ör. şablonu doldurulmamış reklam linki) yeni geliş SAYILMAZ:
    // aynı oturumdaki son dokunuşu (instagram) ezmemeli.
    const a = sayfa('https://viamood.com.tr/?utm_source=instagram&utm_medium=social', '');
    const b = sayfa('https://viamood.com.tr/products/x?utm_source=&utm_medium=&utm_campaign=', '', a.yerel, a.oturum);
    expect(b.kayit.son!.kaynak, 'boş UTM son dokunuşu ezdi').toBe('instagram');
  });

  it('3) YÖNLENDİREN BOŞ ama UTM var: kaynak UTM\'den gelir; dış yönlendiren yalnız ALAN ADI olarak saklanır', () => {
    const bos = sayfa('https://viamood.com.tr/collections/yeni?utm_source=Instagram&utm_medium=social&utm_campaign=ekim', '');
    expect(bos.kayit.ilk).toMatchObject({ kaynak: 'instagram', ortam: 'social', kampanya: 'ekim', yonlendiren: '' });

    // KVKK: tam URL (yol + sorgu) değil yalnız alan adı tutulur
    const dis = sayfa('https://viamood.com.tr/', 'https://l.instagram.com/?u=https%3A%2F%2Fviamood.com.tr&e=ABC123');
    expect(dis.kayit.ilk!.yonlendiren).toBe('l.instagram.com');
    expect(JSON.stringify(dis.kayit)).not.toContain('ABC123');
    // kendi alan adımız yönlendiren SAYILMAZ
    const ic = sayfa('https://viamood.com.tr/cart', 'https://www.viamood.com.tr/products/x');
    expect(ic.kayit.ilk!.yonlendiren).toBe('');
  });

  it('4) AYNI OTURUMDA İKİNCİ ZİYARET: ilk dokunuş ASLA ezilmez; son dokunuş yalnız anlamlı gelişte değişir', () => {
    // a) Instagram kampanyasından ilk giriş
    const a = sayfa('https://viamood.com.tr/products/elbise?utm_source=instagram&utm_medium=social', 'https://l.instagram.com/');
    // b) aynı oturum, iç gezinme (UTM yok, yönlendiren kendimiz) → hiçbir şey değişmez
    const b = sayfa('https://viamood.com.tr/pages/odeme', 'https://viamood.com.tr/products/elbise', a.yerel, a.oturum);
    expect(b.kayit.ilk).toEqual(a.kayit.ilk);
    expect(b.kayit.son).toEqual(a.kayit.son);
    // c) aynı oturum, 3D ödeme dönüşü (banka alan adı yönlendiren) → son dokunuş EZİLMEZ
    const c = sayfa('https://viamood.com.tr/pages/siparis-alindi', 'https://goguvenliodeme.bkm.com.tr/', a.yerel, a.oturum);
    expect(c.kayit.son!.kaynak).toBe('instagram');
    // d) YENİ oturum, Google'dan organik → son güncellenir, ilk Instagram kalır
    const d = sayfa('https://viamood.com.tr/', 'https://www.google.com/', a.yerel, depo());
    expect(d.kayit.ilk!.kaynak).toBe('instagram');
    expect(d.kayit.son!.yonlendiren).toBe('www.google.com');
    // e) yeni oturum, doğrudan giriş → son dokunuş (son DIŞ kaynak) korunur
    const e = sayfa('https://viamood.com.tr/', '', a.yerel, depo());
    expect(e.kayit.son!.yonlendiren).toBe('www.google.com');
    // f) aynı oturumda YENİ kampanya tıklaması → son güncellenir (UTM her zaman anlamlıdır)
    const f = sayfa('https://viamood.com.tr/?utm_source=tiktok&fbclid=XYZ', '', a.yerel, a.oturum);
    expect(f.kayit.son).toMatchObject({ kaynak: 'tiktok', tiklama: 'fbclid' });
    expect(JSON.stringify(f.kayit), 'tıklama kimliğinin DEĞERİ saklanmamalı').not.toContain('XYZ');
    expect(f.kayit.ilk!.kaynak).toBe('instagram');
  });

  it('depo erişilemez (gizli sekme): istisna sızmaz, kayıt bellekten okunur', () => {
    const patlak = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceeded'); } };
    const { kayit } = sayfa('https://viamood.com.tr/?utm_source=google', '', patlak as never, patlak as never);
    expect(kayit.son!.kaynak).toBe('google');
  });
});

describe('sunucu süzgeci (kaynakSuz) — gövde GÜVENİLMEZ girdidir', () => {
  it('çöp girdi → null; siparişe hiçbir şey yazılmaz', () => {
    for (const g of [undefined, null, 'x', 42, [], {}, { ilk: 'x', son: [] }]) {
      expect(kaynakSuz(g)).toBeNull();
      expect(kaynakNitelikleri(kaynakSuz(g))).toEqual([]);
    }
  });

  it('KVKK: UTM\'e gömülü e-posta/telefon maskelenir; giriş yolunun sorgusu atılır; alan adı dışı yönlendiren düşer', () => {
    const k = kaynakSuz({
      ilk: {
        kaynak: 'newsletter', icerik: 'ayse.yilmaz@example.com', terim: '+90 555 111 22 33',
        giris: '/products/x?email=ayse@example.com', yonlendiren: 'https://evil.com/path', tarih: 'dün',
      },
    })!;
    expect(k.ilk!.icerik).toBe('[e-posta]');
    expect(k.ilk!.terim).toBe('[numara]');
    expect(k.ilk!.giris).toBe('/products/x');
    expect(k.ilk!.yonlendiren).toBe('');
    expect(k.ilk!.tarih).toBe('');
    expect(JSON.stringify(kaynakNitelikleri(k))).not.toMatch(/ayse|555/);
  });

  it('note_attributes biçimi + filtrelenebilir etiket (son dokunuş, Türkçe karakter → ASCII)', () => {
    const k = kaynakSuz({
      ilk: { kaynak: 'instagram', ortam: 'social', kampanya: 'ekim', giris: '/products/a', tarih: '2026-10-20T10:00:00.000Z' },
      son: { kaynak: 'Google Arama Ağı', ortam: 'cpc', tiklama: 'gclid', yonlendiren: 'www.google.com' },
    });
    expect(kaynakNitelikleri(k)).toEqual([
      { name: 'kaynak_ilk', value: 'instagram / social / ekim' },
      { name: 'kaynak_ilk_giris', value: '/products/a' },
      { name: 'kaynak_ilk_tarih', value: '2026-10-20T10:00:00.000Z' },
      { name: 'kaynak_son', value: 'google arama ağı / cpc · tıklama: gclid' },
      { name: 'kaynak_son_yonlendiren', value: 'www.google.com' },
    ]);
    expect(kaynakEtiketi(k)).toBe('kaynak-google-arama-agi');
  });

  it('taslak yolları: iz yoksa etiket ve note_attributes DEĞİŞMEZ', () => {
    expect(taslakKaynakAlanlari(undefined, 'via-mood-storefront,paytr-pending')).toEqual({
      tags: 'via-mood-storefront,paytr-pending',
    });
    const t = taslakKaynakAlanlari({ son: { kaynak: 'tiktok' } }, 'via-mood-storefront,paytr-pending');
    expect(t.tags).toBe('via-mood-storefront,paytr-pending,kaynak-tiktok');
    expect(t.note_attributes).toEqual([{ name: 'kaynak_son', value: 'tiktok' }]);
  });
});

describe('beş sipariş yolu kaynağı Shopify\'a yazar', () => {
  it('havale/kapıda: createStorefrontOrder gövdesi note_attributes + etiket taşır', async () => {
    vi.resetModules();
    vi.doMock('@/lib/env', () => ({
      env: { SHOPIFY_ADMIN_ACCESS_TOKEN: 't', SHOPIFY_STORE_DOMAIN: 'test.myshopify.com', SHOPIFY_API_VERSION: '2025-01' },
    }));
    vi.doMock('@/lib/shopify/customer-address', () => ({ upsertCustomerAddress: vi.fn(async () => {}) }));
    vi.doMock('@/lib/shopify/customer-locale', () => ({ ensureTrCustomer: vi.fn(async () => {}) }));
    vi.doMock('@/lib/shopify/vendor-ibans', () => ({ resolveVendorIbans: vi.fn(async () => []) }));
    vi.doMock('@/lib/shopify/adres-uyusmaz', () => ({ ilKoduUyusmazsaEtiketle: vi.fn(async () => {}) }));
    vi.doMock('@/lib/email/sender', () => ({ sendEmail: vi.fn(async () => {}) }));
    vi.doMock('@/lib/email/templates', () => ({ orderConfirmationEmail: vi.fn(() => ({ subject: '', html: '', text: '' })) }));
    const fetchSahte = vi.fn(async () => new Response(JSON.stringify({ order: { id: 1, name: '#1', total_price: '10' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSahte);
    try {
      const { createStorefrontOrder } = await import('@/lib/shopify/create-storefront-order');
      const r = await createStorefrontOrder(
        {
          line_items: [{ variant_id: 1, quantity: 1 }], first_name: 'A', last_name: 'B', phone: '05551112233',
          email: 'a@b.co', address1: 'x', city: 'Kadıköy', province: 'İstanbul',
          kaynak: { ilk: { kaynak: 'instagram', ortam: 'social' }, son: { kaynak: 'instagram', ortam: 'social' } },
        },
        'havale',
      );
      expect(r.ok).toBe(true);
      const order = JSON.parse(String((fetchSahte.mock.calls[0] as unknown as [string, RequestInit])[1].body)).order;
      expect(order.note_attributes).toEqual(
        expect.arrayContaining([
          { name: '_odeme_yontemi', value: 'havale' },
          { name: 'kaynak_ilk', value: 'instagram / social' },
          { name: 'kaynak_son', value: 'instagram / social' },
        ]),
      );
      expect(order.tags.split(',')).toContain('kaynak-instagram');
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  it('kart yolları (iyzico · PayTR · Halköde) taslağa taslakKaynakAlanlari ile yazar — kopya etiket satırı geri dönmez', () => {
    for (const yol of ['iyzico', 'paytr', 'halkode']) {
      const kod = readFileSync(path.join(KOK, `src/app/api/v1/payment/${yol}/initialize/route.ts`), 'utf8');
      expect(kod, `${yol}: kaynak alanı taslağa yazılmıyor`).toMatch(
        new RegExp(`\\.\\.\\.taslakKaynakAlanlari\\(\\w+\\.kaynak, 'via-mood-storefront,${yol}-pending'\\)`),
      );
      expect(kod, `${yol}: sabit etiket satırı kaynak etiketini ezer`).not.toMatch(/^\s*tags: 'via-mood-storefront,/m);
    }
  });

  it('tema: snippet = yakalayıcı bayt bayt; ödeme sayfası buildPayload kaynak alanını gönderir', async () => {
    const { execFileSync } = await import('node:child_process');
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const os = await import('node:os');
    const once = mkdtempSync(path.join(os.tmpdir(), 'k994887-once-'));
    const sonra = mkdtempSync(path.join(os.tmpdir(), 'k994887-sonra-'));
    writeFileSync(path.join(once, 'layout__theme.liquid'), readFileSync(path.join(KOK, 'tema-yamalari/theme.liquid.857-sepet-stok-uyarisi')));
    writeFileSync(
      path.join(once, 'sections__via-checkout.liquid'),
      readFileSync(path.join(KOK, 'tema-yamalari/via-checkout.liquid.994773-VCO-IZGARA-SONRASI')),
    );
    execFileSync('python3', [path.join(KOK, 'tema-yamalari/994887-kaynak-izi/yama.py'), once, sonra]);
    const snip = readFileSync(path.join(sonra, 'snippets__via-kaynak-izi.liquid'), 'utf8');
    expect(snip).toBe(`<script>\n${JS}</script>\n`);
    expect(snip, 'Liquid ayıracı script içine sızarsa tema render bozulur').not.toMatch(/\{\{|\{%/);
    const tema = readFileSync(path.join(sonra, 'layout__theme.liquid'), 'utf8');
    expect(tema.indexOf("{% render 'via-kaynak-izi' %}")).toBeLessThan(tema.indexOf('{{ content_for_header }}'));
    expect(tema.indexOf("{% render 'via-kaynak-izi' %}")).toBeGreaterThan(-1);
    const vco = readFileSync(path.join(sonra, 'sections__via-checkout.liquid'), 'utf8');
    const govde = vco.slice(vco.indexOf('function buildPayload(cart){'), vco.indexOf('/* ============ İyzico'));
    expect(govde).toContain('kaynak: (window.viaKaynak && window.viaKaynak.oku()) || null');
  });
});

describe('#994962 · bilinen yönlendiren → okunur kaynak (UTM yokken)', () => {
  // Ölçülen olay (23 Eki 2026): Google'dan organik gelen #1262/#1263 "kaynak-www.google.com" +
  // "www.google.com / referral" ile düşüyordu; reklam ekibi "google / organic" bekliyor.
  const tek = (yonlendiren: string, ek: Record<string, string> = {}) =>
    kaynakSuz({ son: { yonlendiren, giris: '/', tarih: '2026-10-22T19:23:32.281Z', ...ek } })!.son!;

  it('Google organik: www.google.com / google.com.tr → google · organic; ham alan adı korunur; etiket kaynak-google', () => {
    for (const h of ['www.google.com', 'google.com.tr', 'www.google.com.tr', 'www.google.de']) {
      const d = tek(h);
      expect(d).toMatchObject({ kaynak: 'google', ortam: 'organic', yonlendiren: h });
    }
    const k = kaynakSuz({ son: { yonlendiren: 'www.google.com', giris: '/' } });
    expect(kaynakEtiketi(k)).toBe('kaynak-google');
    expect(kaynakNitelikleri(k)).toEqual(expect.arrayContaining([
      { name: 'kaynak_son', value: 'google / organic' },
      { name: 'kaynak_son_yonlendiren', value: 'www.google.com' },
    ]));
  });

  it('sosyal ve e-posta: l.instagram.com · m.facebook.com · t.co · mail.google.com', () => {
    expect(tek('l.instagram.com')).toMatchObject({ kaynak: 'instagram', ortam: 'social' });
    expect(tek('m.facebook.com')).toMatchObject({ kaynak: 'facebook', ortam: 'social' });
    expect(tek('t.co')).toMatchObject({ kaynak: 'x', ortam: 'social' });
    expect(tek('mail.google.com')).toMatchObject({ kaynak: 'gmail', ortam: 'email' }); // google kuralından ÖNCE
  });

  it('NEGATİF: listede olmayan alan adı eskisi gibi (alan adı / referral); benzer adlar google SAYILMAZ', () => {
    expect(tek('www.hepsiburada.com')).toMatchObject({ kaynak: 'www.hepsiburada.com', ortam: 'referral' });
    expect(yonlendirenKaynagi('www.googleadservices.com')).toBeNull();
    expect(yonlendirenKaynagi('google.evil.com')).toBeNull();
    expect(yonlendirenKaynagi('notgoogle.com')).toBeNull();
  });

  it('NEGATİF: UTM ya da tıklama kimliği varsa yönlendiren eşlemesi DEVREYE GİRMEZ', () => {
    expect(tek('www.google.com', { kaynak: 'instagram', ortam: 'social' })).toMatchObject({ kaynak: 'instagram', ortam: 'social' });
    expect(tek('www.google.com', { tiklama: 'gclid' })).toMatchObject({ kaynak: 'google', ortam: 'cpc' });
    expect(tek('www.google.com', { kampanya: 'ekim' })).toMatchObject({ kaynak: '(belirtilmemiş)' });
  });
});

/** Kapıda ödeme siparişinin Shopify'a giden gövdesi (fetch sahte — gerçek sipariş AÇILMAZ). */
async function codSiparisi(kaynak: unknown) {
  vi.resetModules();
  vi.doMock('@/lib/env', () => ({
    env: { SHOPIFY_ADMIN_ACCESS_TOKEN: 't', SHOPIFY_STORE_DOMAIN: 'test.myshopify.com', SHOPIFY_API_VERSION: '2025-01' },
  }));
  vi.doMock('@/lib/shopify/customer-address', () => ({ upsertCustomerAddress: vi.fn(async () => {}) }));
  vi.doMock('@/lib/shopify/customer-locale', () => ({ ensureTrCustomer: vi.fn(async () => {}) }));
  vi.doMock('@/lib/shopify/vendor-ibans', () => ({ resolveVendorIbans: vi.fn(async () => []) }));
  vi.doMock('@/lib/shopify/adres-uyusmaz', () => ({ ilKoduUyusmazsaEtiketle: vi.fn(async () => {}) }));
  vi.doMock('@/lib/email/sender', () => ({ sendEmail: vi.fn(async () => {}) }));
  vi.doMock('@/lib/email/templates', () => ({ orderConfirmationEmail: vi.fn(() => ({ subject: '', html: '', text: '' })) }));
  const fetchSahte = vi.fn(async () => new Response(JSON.stringify({ order: { id: 1, name: '#1', total_price: '10' } }), { status: 200 }));
  vi.stubGlobal('fetch', fetchSahte);
  try {
    const { createStorefrontOrder } = await import('@/lib/shopify/create-storefront-order');
    const r = await createStorefrontOrder(
      {
        line_items: [{ variant_id: 1, quantity: 1 }], first_name: 'A', last_name: 'B', phone: '05551112233',
        email: 'a@b.co', address1: 'x', city: 'Kadıköy', province: 'İstanbul', ...(kaynak === undefined ? {} : { kaynak }),
      },
      'cod',
    );
    expect(r.ok).toBe(true);
    return JSON.parse(String((fetchSahte.mock.calls[0] as unknown as [string, RequestInit])[1].body)).order as {
      tags: string; note_attributes: Array<{ name: string; value: string }>; [alan: string]: unknown;
    };
  } finally {
    vi.unstubAllGlobals();
    vi.resetModules();
  }
}
const nitelik = (o: { note_attributes: Array<{ name: string; value: string }> }, ad: string) =>
  o.note_attributes.find((n) => n.name === ad)?.value;

describe('#994962 · ÇİVİ — kapıda ödeme siparişi Shopify\'a doğru kaynağı yazar (sipariş düzeyi)', () => {
  // Yunus'un testi: gizli sekme → Google → ViaMood → kapıda ödeme. Shopify "Kanal" alanı siparişi
  // açan uygulamanın adını (Claude) gösterir ve değiştirilemez; kaynak etiket + note_attributes'tadır.
  // MUTASYON: create-storefront-order.ts'te `kaynakSuz(b.kaynak)` çağrısı kaldırılırsa bu blok KIRILIR.
  it('Google\'dan organik gelen kapıda ödeme siparişi: etiket kaynak-google · "google / organic" · yönlendiren alan adı', async () => {
    const dokunus = { yonlendiren: 'www.google.com', giris: '/products/minix-figur', tarih: '2026-10-22T19:23:32.281Z' };
    const o = await codSiparisi({ ilk: dokunus, son: dokunus });
    expect(o.tags.split(',')).toEqual(expect.arrayContaining(['kapida-odeme', 'kaynak-google']));
    expect(nitelik(o, 'kaynak_ilk')).toBe('google / organic');
    expect(nitelik(o, 'kaynak_son')).toBe('google / organic');
    expect(nitelik(o, 'kaynak_son_yonlendiren')).toBe('www.google.com');
    expect(nitelik(o, 'kaynak_son_giris')).toBe('/products/minix-figur');
  });

  it('boş dokunuş (UTM yok, yönlendiren yok) → "(direkt)" · etiket kaynak-direkt', async () => {
    const o = await codSiparisi({ son: { giris: '/', tarih: '2026-10-22T12:17:16.414Z' } });
    expect(nitelik(o, 'kaynak_son')).toBe('(direkt)');
    expect(o.tags.split(',')).toContain('kaynak-direkt');
  });

  it('kaynak alanı HİÇ gelmezse (eski önbellekli sayfa) uydurma kaynak yazılmaz — ödeme notları yerinde', async () => {
    const o = await codSiparisi(undefined);
    expect(o.tags.split(',').some((t) => t.startsWith('kaynak-'))).toBe(false);
    expect(o.note_attributes.some((n) => n.name.startsWith('kaynak'))).toBe(false);
    expect(nitelik(o, '_odeme_yontemi')).toBe('cod');
  });

  it('KVKK: UTM\'e gömülü e-posta/telefon, tam yönlendiren URL\'si ve giriş sorgusu siparişe SIZMAZ', async () => {
    const o = await codSiparisi({
      son: {
        kaynak: 'ayse.yilmaz@example.com', kampanya: 'ara 0532 111 22 33', yonlendiren: 'https://www.google.com/search?q=ayse',
        giris: '/products/x?email=ayse.yilmaz@example.com&tel=05321112233', tarih: '2026-10-22T19:23:32.281Z',
      },
    });
    const govde = JSON.stringify(o.note_attributes) + o.tags;
    expect(govde).not.toMatch(/ayse\.yilmaz@example\.com/);
    expect(govde).not.toMatch(/0532\s?111\s?22\s?33|05321112233/);
    expect(govde).not.toMatch(/https?:\/\//);
    expect(govde).not.toMatch(/\?q=|email=|tel=/);
    expect(nitelik(o, 'kaynak_son')).toContain('[e-posta]');
    expect(nitelik(o, 'kaynak_son')).toContain('[numara]');
  });
});

describe('#995582 · ÇİVİ — Google oturumu siparişe «google» yazar, «claude» HİÇBİR koşulda yazılmaz', () => {
  // Yunus 11. madde (22 + 27 Eki): "gizli sekmeden Google'da aratıp kapıda ödeme sipariş oluşturdum,
  // kaynak hâlâ claude yazıyor". Ölçüm (31 Eki): «Claude» Shopify'daki özel uygulamanın ADI; 146/146
  // siparişte `sourceName` = uygulama kimliği. Kanal sütunu koddan değiştirilemez (sourceName yalnız
  // satış kanalı uygulamasının atıf tanımını kabul eder). Kaynak etikette + Ek ayrıntılardadır.
  // Bu blok zinciri UÇTAN UCA koşar: tema yakalayıcı (gerçek betik) → kaynakSuz → sipariş gövdesi.

  it('(a) Google aramasından gelen oturum → sipariş etiketi kaynak-google · "google / organic"', async () => {
    const { kayit } = sayfa('https://viamood.com.tr/products/minix-figur', 'https://www.google.com/');
    const o = await codSiparisi(kayit);
    expect(o.tags.split(',')).toContain('kaynak-google');
    expect(nitelik(o, 'kaynak_son')).toBe('google / organic');
    expect(nitelik(o, 'kaynak_son_yonlendiren')).toBe('www.google.com');
  });

  it('(a) Android Google uygulaması (android-app://…googlequicksearchbox) → google / organic; Gmail uygulaması → gmail / email', async () => {
    const g = sayfa('https://viamood.com.tr/', 'android-app://com.google.android.googlequicksearchbox/https/www.google.com');
    const o = await codSiparisi(g.kayit);
    expect(o.tags.split(',')).toContain('kaynak-google');
    expect(nitelik(o, 'kaynak_son')).toBe('google / organic');
    const m = sayfa('https://viamood.com.tr/', 'android-app://com.google.android.gm/');
    expect(kaynakSuz(m.kayit)!.son).toMatchObject({ kaynak: 'gmail', ortam: 'email' });
  });

  it('WhatsApp bağlantı yönlendiricisi l.wl.co → whatsapp / social (ölçülen: #1278, #1282 kaynak-l.wl.co)', async () => {
    const { kayit } = sayfa('https://viamood.com.tr/products/x', 'https://l.wl.co/l?u=https%3A%2F%2Fviamood.com.tr%2Fproducts%2Fx');
    const o = await codSiparisi(kayit);
    expect(o.tags.split(',')).toContain('kaynak-whatsapp');
    expect(nitelik(o, 'kaynak_son')).toBe('whatsapp / social');
    expect(nitelik(o, 'kaynak_son_yonlendiren')).toBe('l.wl.co');
  });

  it('(b) yönlendiren YOK → "(direkt)"; gövdenin hiçbir yerinde «claude» yok; Kanal alanı (source_name) taklit edilmez', async () => {
    const { kayit } = sayfa('https://viamood.com.tr/', '');
    for (const o of [await codSiparisi(kayit), await codSiparisi(undefined)]) {
      expect(JSON.stringify(o), 'sipariş gövdesine «claude» yazıldı').not.toMatch(/claude/i);
      expect(Object.keys(o).filter((a) => /source/i.test(a)), 'Kanal alanı uydurma değerle dolduruldu').toEqual([]);
    }
    const o = await codSiparisi(kayit);
    expect(nitelik(o, 'kaynak_son')).toBe('(direkt)');
    expect(o.tags.split(',')).toContain('kaynak-direkt');
    // kart yolları (taslak): iz yok ya da direkt → «claude» yok
    for (const ham of [undefined, kayit]) {
      expect(JSON.stringify(taslakKaynakAlanlari(ham, 'via-mood-storefront,halkode-pending'))).not.toMatch(/claude/i);
    }
  });
});
