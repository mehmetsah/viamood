/**
 * #994753 — Meta Pixel Purchase (sipariş-alındı sayfası) çivileri.
 * Tema betiği Liquid dosyasından çıkarılır ve sahte tarayıcı ortamında koşturulur;
 * canlıya/Meta'ya HİÇBİR istek gitmez.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const LIQUID = readFileSync(join(__dirname, '../tema-yamalari/via-order-success.liquid.994753-META-PURCHASE'), 'utf8');
const BETIK = (LIQUID.match(/<script>([\s\S]*?)<\/script>/) ?? [])[1] ?? '';

type Cagri = { olay: string; yuk: Record<string, unknown>; secenek?: Record<string, unknown> };

function kos(qs: string, opts: { fbq?: boolean; local?: Map<string, string>; zamanlayici?: Array<() => void>; localBozuk?: boolean } = {}) {
  const cagrilar: Cagri[] = [];
  const local = opts.local ?? new Map<string, string>();
  const depo = (m: Map<string, string>) => ({ getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } });
  const window: Record<string, unknown> = {};
  const fbq = (_k: string, olay: string, yuk: Record<string, unknown>, secenek?: Record<string, unknown>) => { cagrilar.push({ olay, yuk, secenek }); };
  if (opts.fbq !== false) window.fbq = fbq;
  // zamanlayici verilirse setTimeout geri çağrıları biriktirilir (adım adım ilerletmek için)
  const setTimeout = opts.zamanlayici ? (f: () => void) => { opts.zamanlayici!.push(f); return 0; } : () => 0;
  const ctx = vm.createContext({
    window, URLSearchParams,
    location: { search: qs }, // betik window.location.search okuyor
    document: { querySelector: () => null, querySelectorAll: () => [] , body: {} },
    sessionStorage: depo(new Map()),
    localStorage: opts.localBozuk ? { getItem: () => { throw new Error('kota'); }, setItem: () => { throw new Error('kota'); } } : depo(local),
    fetch: () => new Promise(() => {}), // ağ YOK: özet API'si hiç dönmez
    setTimeout, navigator: {},
  });
  (window as { location?: unknown }).location = { search: qs };
  vm.runInContext(BETIK.replace(/window\.location\.search/g, 'location.search'), ctx);
  return { cagrilar, window, local, fbq };
}

describe('Meta Purchase — sipariş-alındı', () => {
  it('betik Liquid dosyasından çıkarılabiliyor ve Purchase bloğunu içeriyor', () => {
    expect(BETIK).toContain("fbq('track', 'Purchase'");
    expect(BETIK).toContain("'via-pur-'");
  });

  it('tutar URL\'deyse Purchase BİR KEZ, doğru değer + eventID ile gider', () => {
    const { cagrilar } = kos('?order=1032&yontem=kapida&total=1300.5');
    const p = cagrilar.filter((c) => c.olay === 'Purchase');
    expect(p).toHaveLength(1);
    expect(p[0].yuk).toMatchObject({ value: 1300.5, currency: 'TRY', order_id: '1032' });
    expect(p[0].secenek).toEqual({ eventID: 'via-pur-1032' });
  });

  it('ÇİFT CİRO YOK — aynı sipariş ikinci açılışta Purchase GÖNDERMEZ (localStorage)', () => {
    const local = new Map<string, string>();
    kos('?order=1032&yontem=kapida&total=1300.5', { local });
    const { cagrilar } = kos('?order=1032&yontem=kapida&total=1300.5', { local });
    expect(cagrilar.filter((c) => c.olay === 'Purchase')).toHaveLength(0);
  });

  it('farklı sipariş ayrı Purchase üretir (tekilleştirme sipariş bazlı)', () => {
    const local = new Map<string, string>();
    kos('?order=1032&total=100', { local });
    const { cagrilar } = kos('?order=1033&total=200', { local });
    expect(cagrilar.filter((c) => c.olay === 'Purchase')).toHaveLength(1);
  });

  it('tutar yoksa hemen GÖNDERMEZ; özet API\'si toplam getirince BİR KEZ gönderir', () => {
    const { cagrilar, window } = kos('?order=1700000000000&pid=x');
    expect(cagrilar.filter((c) => c.olay === 'Purchase')).toHaveLength(0);
    const bekle = window.__viaMetaPurBekle as (t: string) => void;
    expect(typeof bekle).toBe('function');
    bekle('450.00');
    bekle('450.00');
    const p = cagrilar.filter((c) => c.olay === 'Purchase');
    expect(p).toHaveLength(1);
    expect(p[0].yuk.value).toBe(450);
  });

  it('0 / geçersiz tutar Purchase GÖNDERMEZ', () => {
    expect(kos('?order=1&total=0').cagrilar).toHaveLength(0);
    expect(kos('?order=2&total=abc').cagrilar).toHaveLength(0);
    expect(kos('?order=3&total=-5').cagrilar).toHaveLength(0);
  });

  it('fbq ASYNC gelir (#994828) — ayrıştırma anında yoksa BEKLER, gelince Purchase BİR KEZ gider', () => {
    const kuyruk: Array<() => void> = [];
    const { cagrilar, window, fbq } = kos('?order=2001&yontem=kapida&total=99.9', { fbq: false, zamanlayici: kuyruk });
    expect(cagrilar).toHaveLength(0);
    // 3 sn (12 tur) fbq yok — her tur yeniden dener
    for (let i = 0; i < 12; i++) kuyruk.shift()!();
    expect(cagrilar).toHaveLength(0);
    window.fbq = fbq; // Shopify Web Pixel geldi
    kuyruk.shift()!();
    const p = cagrilar.filter((c) => c.olay === 'Purchase');
    expect(p).toHaveLength(1);
    expect(p[0].secenek).toEqual({ eventID: 'via-pur-2001' });
    expect(kuyruk).toHaveLength(0); // gönderdikten sonra döngü durur
  });

  it('fbq 20 sn içinde HİÇ gelmezse bekleme SONLANIR (sonsuz döngü yok), damga yazılmaz', () => {
    const kuyruk: Array<() => void> = [];
    const local = new Map<string, string>();
    kos('?order=2002&total=10', { fbq: false, local, zamanlayici: kuyruk });
    let tur = 0;
    while (kuyruk.length && tur < 1000) { kuyruk.shift()!(); tur++; }
    expect(tur).toBe(80);
    expect([...local.keys()].filter((k) => k.startsWith('via_fb_pur_'))).toHaveLength(0);
  });

  it('localStorage bozuksa bile aynı sayfada ikinci Purchase GİTMEZ (bellek koruması)', () => {
    const { cagrilar, window } = kos('?order=2003&pid=x', { localBozuk: true });
    const bekle = window.__viaMetaPurBekle as (t: string) => void;
    bekle('10'); bekle('10');
    expect(cagrilar.filter((c) => c.olay === 'Purchase')).toHaveLength(1);
  });

  it('NEGATİF — fbq yoksa sayfa betiği PATLAMAZ ve hiçbir şey yazmaz', () => {
    const local = new Map<string, string>();
    expect(() => kos('?order=9&total=10', { fbq: false, local })).not.toThrow();
    expect([...local.keys()].filter((k) => k.startsWith('via_fb_pur_'))).toHaveLength(0);
  });
});
