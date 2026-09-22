/**
 * ÇİVİ — anasayfa "Siteye Özel Fiyat" kampanya modalının açılma gecikmesi.
 *
 * TALEP (Yunus, 22 Eyl 2026): modal 1 sn yerine 15 sn sonra açılsın.
 *
 * ÖLÇÜLEN TUZAK: gecikme ÜÇ ayrı yerde yaşıyordu — Liquid geri düşüşü, JS geri
 * düşüşü ve schema default'u — üstelik asıl yürürlükteki değer bunların HİÇBİRİ
 * değil, `templates/index.json`de KAYITLI olan ayardı. Yalnız schema default'u
 * değiştirilseydi canlıda hiçbir şey değişmezdi.
 *
 * Bu dosya yama dosyasının GERÇEK metnini okur ve içindeki modal JS'ini sahte
 * DOM + sahte zamanlayıcıyla koşturur — kopya kod üzerinde değil, yayına
 * gidecek metin üzerinde ölçüm yapar.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const YAMA = join(__dirname, '..', 'tema-yamalari', 'via-mood-home-v2.liquid.kampanya-gecikme');
const INDEX = join(__dirname, '..', 'tema-yamalari', 'index.json.kampanya-gecikme');
const HEDEF_MS = 15000;

const kaynak = () => readFileSync(YAMA, 'utf8');

/** Modal davranış JS'ini yama dosyasından çıkarır. */
function modalJs(src: string): string {
  const i = src.indexOf('Kampanya banner davranışı');
  const bas = src.indexOf('<script>', i);
  const son = src.indexOf('</script>', bas);
  return src.slice(bas + '<script>'.length, son);
}

type Kosu = { gecikmeler: number[]; acildi: boolean; damga: string | null };

/**
 * ⚠ `kapat` VARSAYILAN OLARAK TETİKLENMEZ. Modal gizliyken bile overlay'in click
 * dinleyicisi kuruluyor (kod `gizliMi()` erken dönüşünü dinleyicilerden SONRA
 * yapıyor); kapatmayı her senaryoda tetiklemek `kapat()` içindeki 420 ms'lik
 * kapanış zamanlayıcısını ölçüme karıştırır ve "hiç kurulmadı" iddiasını
 * yanlışlıkla çürütürdü.
 */
function kos(opt: {
  gecikmeOz: string;
  siklik?: string;
  onceKapatilmis?: boolean;
  kapat?: boolean;
}): Kosu {
  const { gecikmeOz, siklik = 'session', onceKapatilmis = false, kapat = false } = opt;
  let simdi = 0;
  const kuyruk: Array<{ t: number; fn: () => void; bitti?: boolean }> = [];
  const gecikmeler: number[] = [];
  const depo = new Map<string, string>();
  const olaylar: Record<string, Array<(e: unknown) => void>> = {};
  const sinif = new Set<string>();
  if (onceKapatilmis) depo.set('s:vmk-kampanya-kapali', '1');

  const btn = { focus() {}, addEventListener() {} };
  const ov = {
    hidden: true,
    offsetWidth: 0,
    classList: { add: (c: string) => sinif.add(c), remove: (c: string) => sinif.delete(c) },
    getAttribute: (a: string) =>
      (({ 'data-vmk-gecikme': gecikmeOz, 'data-vmk-siklik': siklik }) as Record<string, string>)[a],
    querySelector: (s: string) => (s === '.vmk-close' ? btn : null),
    addEventListener(t: string, f: (e: unknown) => void) {
      (olaylar[t] ||= []).push(f);
    },
  };
  const document = {
    getElementById: (id: string) => (id === 'vmk-overlay' ? ov : null),
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
    readyState: 'complete',
  };
  const window = {
    sessionStorage: {
      getItem: (k: string) => depo.get('s:' + k) ?? null,
      setItem: (k: string, v: string) => depo.set('s:' + k, String(v)),
    },
    localStorage: {
      getItem: (k: string) => depo.get('l:' + k) ?? null,
      setItem: (k: string, v: string) => depo.set('l:' + k, String(v)),
    },
    addEventListener() {},
  };
  const setTimeoutSahte = (fn: () => void, ms: number) => {
    gecikmeler.push(ms);
    kuyruk.push({ t: simdi + ms, fn });
  };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('document', 'window', 'setTimeout', 'console', modalJs(kaynak()))(
    document, window, setTimeoutSahte, console,
  );

  simdi += 60000;
  for (const x of kuyruk.filter((k) => k.t <= simdi && !k.bitti)) {
    x.bitti = true;
    x.fn();
  }
  // Açılma, KAPATMADAN ÖNCE ölçülür — kapatma 'vmk-acik' sınıfını geri alıyor.
  const acildi = sinif.has('vmk-acik') && ov.hidden === false;
  // kapatma düğmesine bas (overlay boşluğu tıklaması aynı yolu kullanır)
  if (kapat) olaylar['click']?.[0]?.({ target: ov });
  return { gecikmeler, acildi, damga: depo.get('s:vmk-kampanya-kapali') ?? null };
}

describe('kampanya modalı — açılma gecikmesi 15 sn', () => {
  it('yürürlükteki değer index.json’da 15000 (asıl etki burada)', () => {
    const d = JSON.parse(readFileSync(INDEX, 'utf8'));
    expect(d.sections.via_home_v2.settings.kampanya_gecikme).toBe(HEDEF_MS);
  });

  it('modal setTimeout’u 15000 ms ile kurar ve süre dolunca açılır', () => {
    const r = kos({ gecikmeOz: String(HEDEF_MS) });
    expect(r.gecikmeler[0]).toBe(HEDEF_MS);
    expect(r.acildi).toBe(true);
  });

  it.each(['', 'abc', '-5'])('öznitelik bozuksa (%j) geri düşüş de 15000', (v) => {
    expect(kos({ gecikmeOz: v }).gecikmeler[0]).toBe(HEDEF_MS);
  });

  it('Liquid ve schema geri düşüşlerinde 1000 KALMADI', () => {
    const s = kaynak();
    expect(s).toContain('assign kmp_gecikme = sec.kampanya_gecikme | default: 15000');
    expect(s).toContain('gecikme = 15000;');
    expect(s).not.toMatch(/kmp_gecikme[^\n]*default:\s*1000/);
  });

  it('schema range DEĞİL number — Shopify range üst sınırı 10000 ms', () => {
    const s = kaynak();
    const blok = s.slice(s.indexOf('"id": "kampanya_gecikme"') - 60, s.indexOf('"id": "kampanya_gecikme"') + 320);
    expect(blok).toContain('"type": "number"');
    expect(blok).not.toContain('"type": "range"');
    expect(blok).toContain('"default": 15000');
  });
});

describe('session davranışı DEĞİŞMEDİ', () => {
  it('index.json’da sıklık hâlâ session', () => {
    const d = JSON.parse(readFileSync(INDEX, 'utf8'));
    expect(d.sections.via_home_v2.settings.kampanya_siklik).toBe('session');
  });

  it('kapatınca oturum damgası yazılır', () => {
    expect(kos({ gecikmeOz: String(HEDEF_MS), kapat: true }).damga).toBe('1');
  });

  it('oturumda kapatılmışsa modal HİÇ kurulmaz', () => {
    const r = kos({ gecikmeOz: String(HEDEF_MS), onceKapatilmis: true });
    expect(r.gecikmeler).toEqual([]);
    expect(r.acildi).toBe(false);
  });

  it("sıklık 'her-acilis' ise damgaya rağmen kurulur", () => {
    const r = kos({ gecikmeOz: String(HEDEF_MS), siklik: 'her-acilis', onceKapatilmis: true });
    expect(r.gecikmeler[0]).toBe(HEDEF_MS);
  });
});
