/**
 * viamood.com.tr/pages/odeme — Halköde GİZLİ KAPI bekçisi (21 Eyl 2026).
 *
 * Ölçülen dosya: tema-yamalari/via-checkout.liquid.halkode-form-b — canlı temaya
 * (sections/via-checkout.liquid) basılan içeriğin birebir kopyası. (21 Eyl 16:xx'ten önce
 * canlıdaki hâl: .halkode-gizli-kapi — Seçenek B formu yalnız GÖRÜNÜMÜ değiştirdi; 1-3
 * aynı iddialarla yeni kopyada da geçmeli, akışın değişmediğinin kanıtı budur.)
 *
 * Dört şey çivilenir:
 *  1) KAPI: parametresiz ziyaretçi section ayarındaki sağlayıcıda kalır (bugün PayTR);
 *     yalnız ?halkode=1 oturumu Halköde'ye döner, ?halkode=0 kapatır.
 *  2) YÖNLENDİRME: startKart'ın paytr/iyzico dalları değişmedi.
 *  3) SÖZLEŞME: initialize'ın zorunlu tuttuğu her alan temanın gönderdiği gövdede var.
 *  4) Kart alanları console/localStorage/sepet özniteliğine yazılmaz. Formun BÖLGE KİLİDİ
 *     (onaylı Seçenek B maketi ↔ ürün) ayrı dosyada: tests/halkode-form-b.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const KOK = path.resolve(__dirname, '..');
const TEMA = readFileSync(path.join(KOK, 'tema-yamalari/via-checkout.liquid.halkode-form-b'), 'utf8');
const ROUTE = readFileSync(path.join(KOK, 'src/app/api/v1/payment/halkode/initialize/route.ts'), 'utf8');

/** Çapanın tam 1 kez geçtiğini iddia ederek dilim alır (CLAUDE.md §3c: sınır yapıyla çizilir). */
function tekIndex(s: string, capa: string): number {
  const i = s.indexOf(capa);
  expect(i, `çapa yok: ${capa}`).toBeGreaterThan(-1);
  expect(s.indexOf(capa, i + 1), `çapa birden çok: ${capa}`).toBe(-1);
  return i;
}

/** `function ad(...){ ... }` gövdesini dengeli süslü parantez sayımıyla çıkarır. */
function islev(s: string, ad: string): string {
  const bas = tekIndex(s, `function ${ad}(`);
  const ac = s.indexOf('{', s.indexOf(')', bas));
  let derinlik = 0;
  for (let i = ac; i < s.length; i++) {
    if (s[i] === '{') derinlik++;
    else if (s[i] === '}' && --derinlik === 0) return s.slice(bas, i + 1);
  }
  throw new Error(`gövde kapanmadı: ${ad}`);
}

// Kapı IIFE'si ve hemen ardındaki atama.
const KAPI_BAS = tekIndex(TEMA, 'var HALKODE_KAPI = (function(){');
const KAPI_SON = tekIndex(TEMA, "if(HALKODE_KAPI) KART_GATEWAY = 'halkode';") + "if(HALKODE_KAPI) KART_GATEWAY = 'halkode';".length;
const KAPI = TEMA.slice(KAPI_BAS, KAPI_SON);

function kapiKos(search: string, depo: Map<string, string>, ayar = 'paytr'): string {
  const sessionStorage = {
    getItem: (k: string) => (depo.has(k) ? depo.get(k)! : null),
    setItem: (k: string, v: string) => void depo.set(k, String(v)),
    removeItem: (k: string) => void depo.delete(k),
  };
  const window = { location: { search } };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function('window', 'sessionStorage', `var KART_GATEWAY = ${JSON.stringify(ayar)};\n${KAPI}\nreturn KART_GATEWAY;`)(
    window,
    sessionStorage,
  );
}

describe('1) gizli kapı', () => {
  it('kapı dilimi doğru yerden kesildi', () => {
    expect(KAPI.length).toBeGreaterThan(200);
    expect(KAPI.length).toBeLessThan(900);
  });

  it('parametresiz ziyaretçi section ayarında kalır (PayTR)', () => {
    expect(kapiKos('', new Map())).toBe('paytr');
    expect(kapiKos('?utm_source=x', new Map())).toBe('paytr');
    expect(kapiKos('?halkode=2', new Map())).toBe('paytr');
  });

  it('?halkode=1 oturumu Halköde yapar ve oturum boyu kalır', () => {
    const depo = new Map<string, string>();
    expect(kapiKos('?halkode=1', depo)).toBe('halkode');
    expect(kapiKos('', depo)).toBe('halkode'); // aynı sekmede parametresiz dönüş
  });

  it('?halkode=0 kapıyı kapatır', () => {
    const depo = new Map<string, string>([['vm_halkode_kapi', '1']]);
    expect(kapiKos('?halkode=0', depo)).toBe('paytr');
    expect(kapiKos('', depo)).toBe('paytr');
  });

  it('sessionStorage erişilemezse yalnız URL karar verir', () => {
    const kirik = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
    const kos = (q: string) =>
      new Function('window', 'sessionStorage', `var KART_GATEWAY = "paytr";\n${KAPI}\nreturn KART_GATEWAY;`)({ location: { search: q } }, kirik);
    expect(kos('')).toBe('paytr');
    expect(kos('?halkode=1')).toBe('halkode');
  });
});

describe('2) startKart yönlendirmesi', () => {
  const START = islev(TEMA, 'startKart');
  function hangisi(gw: string): string {
    const cagri: string[] = [];
    new Function(
      'KART_GATEWAY',
      'startPaymentHalkode',
      'startPaymentPaytr',
      'startPayment',
      `${START}; startKart({});`,
    )(gw, () => cagri.push('halkode'), () => cagri.push('paytr'), () => cagri.push('iyzico'));
    return cagri.join(',');
  }
  it('paytr → yalnız PayTR iframe akışı', () => expect(hangisi('paytr')).toBe('paytr'));
  it('iyzico → yalnız İyzico akışı', () => expect(hangisi('iyzico')).toBe('iyzico'));
  it('halkode → yalnız Halköde formu', () => expect(hangisi('halkode')).toBe('halkode'));
});

describe('3) initialize sözleşmesi', () => {
  it('route’un zorunlu alanlarının hepsi temanın gövdesinde', () => {
    const zorunlu = [...ROUTE.matchAll(/missing\.push\('([a-z0-9_]+)'\)/g)].map((m) => m[1]);
    expect(zorunlu.length).toBeGreaterThanOrEqual(12);
    const govde = islev(TEMA, 'buildPayload');
    const hkOde = islev(TEMA, 'hkOde');
    const eksik = zorunlu.filter(
      (a) => !new RegExp(`(^|[\\s{,])${a}\\s*:`).test(govde) && !new RegExp(`\\bp\\.${a}\\s*=`).test(hkOde),
    );
    expect(eksik).toEqual([]);
  });

  it('tema Halköde initialize ucuna gider ve 3D formunu belgeye yazar', () => {
    const hkOde = islev(TEMA, 'hkOde');
    expect(hkOde).toContain("API + '/api/v1/payment/halkode/initialize'");
    expect(hkOde).toContain('document.write(data.form_html)');
    expect(hkOde).toContain('kuponReddedildi(data)'); // route discount_rejected döner
    expect(ROUTE).toContain("error: 'discount_rejected'");
  });
});

describe('4) kart verisi — kart formu', () => {
  const FORM = islev(TEMA, 'renderHalkodeForm');
  // Formun iskeleti saf bir işlevde: çalıştırıp ÜRETİLEN HTML ölçülür (kaynak metni değil).
  const MARKUP: string = new Function(`${islev(TEMA, 'hkIc')}\n${islev(TEMA, 'hkFormHtml')}\nreturn hkFormHtml();`)();

  it('iskelet üretildi ve kart alanlarının rolleri yerinde', () => {
    expect(MARKUP.length).toBeGreaterThan(1500);
    const roller = [...MARKUP.matchAll(/data-hk="([a-z-]+)"/g)].map((m) => m[1]).sort();
    expect(roller).toEqual(['ad', 'cvv', 'no', 'ode', 'skt', 'taksit', 'taksit-liste', 'taksit-satir', 'tur', 'tutar', 'tutar-not'].sort());
  });

  it('emoji yok', () => {
    const blok = TEMA.slice(tekIndex(TEMA, '/* ============ Halköde (Kredi Kartı'), tekIndex(TEMA, '  function startPayment(opts){'));
    expect(blok).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('kart alanları hiçbir yere yazılmaz', () => {
    // Yorumlar ölçülmez: yasağı ANLATAN yorum yasağı ihlal etmiş sayılmasın (CLAUDE.md §3c-ter).
    const blok = TEMA.slice(tekIndex(TEMA, '/* ============ Halköde (Kredi Kartı'), tekIndex(TEMA, '  function startPayment(opts){'))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/\s.*$/gm, '$1');
    expect(blok).toContain('function hkOde('); // maskeleme kodu silmedi
    expect(blok).not.toMatch(/console\./);
    expect(blok).not.toMatch(/localStorage|sessionStorage/);
    expect(MARKUP).not.toMatch(/data-f=/); // dataSig/saveAttrs yalnız data-f okur
    expect(FORM).toContain("setAttribute('data-clarity-mask','True')");
    expect(islev(TEMA, 'saveAttrs')).not.toMatch(/data-hk|hkEl|cc_no|cvv/);
  });
});
