/**
 * #995332 · ayse:802 · E8 — `via-kart-gorsel.js` DAVRANIŞ KOŞUMU.
 * Betik tarayıcıda koşan bir IIFE; statik çivi (kart-gorsel-tutarlilik-tema.test.ts) yalnız METNİNİ okur.
 * Bu koşum betiği `node:vm` içinde sahte DOM + sahte 2B tuval ile ÇALIŞTIRIR ve gözlenebilir çıktısını
 * (her görselin style.scale / style.translate / data-via-kirp değeri, hata, load dinleyici ve rAF sayısı) toplar.
 * Ürün dosyasına dokunmaz; yalnız okur.
 * Model: tuval `drawImage(img,0,0,w,h)` görseli w×h'ye en yakın komşu örneklemiyle çizer; genişlik/yükseklik
 * atanınca tuval temizlenir; `getImageData` 0 boyutta IndexSizeError atar; MutationObserver yalnız
 * `childList && subtree` ile derindeki eklemeyi görür, üç türden hiçbiri yoksa `observe` TypeError atar.
 */
import vm from 'node:vm';

export const SECICI = '.product-card .product-media__image, .vkol2-media img';

export type Piksel = [number, number, number, number];
export type PikselFn = (u: number, v: number) => Piksel;

export interface GorselTanim {
  ad: string;
  nw: number;
  nh: number;
  W: number;
  H: number;
  pix: PikselFn;
  /** false → henüz yüklenmedi (naturalWidth 0); 'kademeli' → yükleme sürüyor ama naturalWidth > 0 */
  complete?: boolean | 'kademeli';
}

export interface Gorsel {
  ad: string;
  naturalWidth: number;
  naturalHeight: number;
  complete: boolean;
  offsetWidth: number;
  offsetHeight: number;
  style: Record<string, string>;
  dataset: Record<string, string>;
  _pix: PikselFn;
  _dinleyici: Record<string, Array<() => void>>;
  _yukleNw: number;
  _yukleNh: number;
  addEventListener(tur: string, fn: () => void): void;
}

export interface KurSecenek {
  search?: string;
  readyState?: string;
  ctxYok?: boolean;
  okumaHatasi?: boolean;
}

const BEYAZ: Piksel = [255, 255, 255, 255];
const SEFFAF: Piksel = [0, 0, 0, 0];

/** Zemin + dikdörtgen bölgeler; sonra gelen bölge öncekinin üstüne çizilir. u,v ∈ [0,1). */
export function resim(zemin: Piksel, bolgeler: Array<[number, number, number, number, Piksel]>): PikselFn {
  return (u, v) => {
    let p = zemin;
    for (const [x0, y0, x1, y1, renk] of bolgeler) if (u >= x0 && u < x1 && v >= y0 && v < y1) p = renk;
    return p;
  };
}
export const beyazZemin = (b: Array<[number, number, number, number, Piksel]>) => resim(BEYAZ, b);
export const seffafZemin = (b: Array<[number, number, number, number, Piksel]>) => resim(SEFFAF, b);

/** WebIDL `unsigned long` / `long` dönüşümünün bu koşum için yeterli hâli: NaN/±∞ → 0, kesir kesilir. */
const tamsayi = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

export function kur(src: string, sec: KurSecenek = {}) {
  const sayac = { raf: 0, getContext: 0 };
  const hatalar: string[] = [];
  const dom: Gorsel[] = [];
  const pencereDinleyici: Record<string, Array<() => void>> = {};
  const belgeDinleyici: Record<string, Array<() => void>> = {};
  let rafKuyruk: Array<() => void> = [];
  const zamanlayici = new Map<number, () => void>();
  let sonId = 0;
  let mo: { cb: () => void; hedef: unknown; secenek: Record<string, unknown> } | null = null;
  let cizim: { img: Gorsel; w: number; h: number } | null = null;

  const guvenli = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      hatalar.push(String((e as Error)?.name ?? e));
    }
  };

  const tuval = {
    _w: 300,
    _h: 150,
    get width() {
      return this._w;
    },
    set width(v: number) {
      this._w = Math.max(0, tamsayi(v));
      cizim = null;
    },
    get height() {
      return this._h;
    },
    set height(v: number) {
      this._h = Math.max(0, tamsayi(v));
      cizim = null;
    },
    getContext() {
      sayac.getContext++;
      return sec.ctxYok ? null : baglam;
    },
  };
  const baglam = {
    clearRect() {
      cizim = null;
    },
    drawImage(img: Gorsel, _x: number, _y: number, w: number, h: number) {
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
      cizim = { img, w, h };
    },
    getImageData(_sx: number, _sy: number, sw: number, sh: number) {
      if (sec.okumaHatasi) {
        const e = new Error('tainted');
        e.name = 'SecurityError';
        throw e;
      }
      const w = tamsayi(sw);
      const h = tamsayi(sh);
      if (w <= 0 || h <= 0) {
        const e = new Error('index');
        e.name = 'IndexSizeError';
        throw e;
      }
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          let p: Piksel = SEFFAF;
          if (cizim && x < tuval._w && y < tuval._h && x < cizim.w && y < cizim.h)
            p = cizim.img._pix((x + 0.5) / cizim.w, (y + 0.5) / cizim.h);
          data.set(p, (y * w + x) * 4);
        }
      return { data, width: w, height: h };
    },
  };

  class SahteMO {
    cb: () => void;
    constructor(cb: () => void) {
      this.cb = cb;
    }
    observe(hedef: unknown, secenek: Record<string, unknown>) {
      if (!secenek || !(secenek.childList || secenek.attributes || secenek.characterData))
        throw new TypeError('observe: childList/attributes/characterData');
      mo = { cb: this.cb, hedef, secenek };
    }
  }

  const document = {
    readyState: sec.readyState ?? 'interactive',
    documentElement: { ad: 'html' },
    createElement: () => tuval,
    querySelectorAll: (s: string) => (s === SECICI ? dom.slice() : []),
    addEventListener: (t: string, fn: () => void) => {
      (belgeDinleyici[t] ??= []).push(fn);
    },
  };

  const ctx = vm.createContext({
    document,
    location: { search: sec.search ?? '' },
    MutationObserver: SahteMO,
    requestAnimationFrame: (fn: () => void) => {
      sayac.raf++;
      rafKuyruk.push(fn);
      return ++sonId;
    },
    setTimeout: (fn: () => void) => {
      const id = ++sonId;
      zamanlayici.set(id, fn);
      return id;
    },
    clearTimeout: (id: number) => {
      zamanlayici.delete(id);
    },
    addEventListener: (t: string, fn: () => void) => {
      (pencereDinleyici[t] ??= []).push(fn);
    },
  });

  const api = {
    sayac,
    hatalar,
    dom,
    belge: document,
    get mo() {
      return mo;
    },
    belgeDinleyici,
    pencereDinleyici,
    /** Görseli DOM'a koyar (MutationObserver'ı TETİKLEMEZ — `moTetikle` ayrı). */
    ekle(t: GorselTanim): Gorsel {
      const tamam = t.complete ?? true;
      const boyutVar = tamam !== false;
      const g: Gorsel = {
        ad: t.ad,
        naturalWidth: boyutVar ? t.nw : 0,
        naturalHeight: boyutVar ? t.nh : 0,
        complete: tamam === true,
        offsetWidth: t.W,
        offsetHeight: t.H,
        style: {},
        dataset: {},
        _pix: t.pix,
        _dinleyici: {},
        _yukleNw: t.nw,
        _yukleNh: t.nh,
        addEventListener(tur: string, fn: () => void) {
          (this._dinleyici[tur] ??= []).push(fn);
        },
      };
      dom.push(g);
      return g;
    },
    /** Betiği koşturur. Üst düzey hata `hatalar`a yazılır (tarayıcıdaki gibi sayfa düşmez). */
    calistir() {
      guvenli(() => vm.runInContext(src, ctx));
    },
    /** Derin DOM eklemesini gözlemciye bildirir — yalnız childList + subtree ile görülür. */
    moTetikle() {
      if (mo && mo.secenek.childList && mo.secenek.subtree) {
        const cb = mo.cb;
        guvenli(() => cb());
      }
    },
    rafCalistir() {
      const q = rafKuyruk;
      rafKuyruk = [];
      for (const fn of q) guvenli(fn);
    },
    dcl() {
      for (const fn of belgeDinleyici.DOMContentLoaded ?? []) guvenli(fn);
    },
    yukle(g: Gorsel) {
      g.complete = true;
      g.naturalWidth = g._yukleNw;
      g.naturalHeight = g._yukleNh;
      for (const fn of g._dinleyici.load ?? []) guvenli(fn);
    },
    boyutla(g: Gorsel, W: number, H: number) {
      g.offsetWidth = W;
      g.offsetHeight = H;
    },
    resize() {
      for (const fn of pencereDinleyici.resize ?? []) guvenli(fn);
    },
    zamanlayiciCalistir() {
      const q = [...zamanlayici.values()];
      zamanlayici.clear();
      for (const fn of q) guvenli(fn);
    },
    /** Gözlenebilir çıktı: görsel başına scale / translate / data-via-kirp + load dinleyici sayısı. */
    cikti() {
      return dom.map((g) => ({
        ad: g.ad,
        scale: g.style.scale ?? null,
        translate: g.style.translate ?? null,
        kirp: g.dataset.viaKirp ?? null,
        load: (g._dinleyici.load ?? []).length,
      }));
    },
  };
  return api;
}

// ───────────────────────── FİKSTÜRLER ─────────────────────────
// Kap boyları sahadan: 1280 arama 288×432 · 768 336×504 · 390 154×231 (hepsi 2/3).
const K: Piksel = [30, 30, 30, 255];
export const FIKSTUR: GorselTanim[] = [
  // F1 beyaz zeminli kare paket (Hot Wheels sınıfı) — büyütülür, ortada kalır
  { ad: 'F1-kare-paket', nw: 1000, nh: 1000, W: 288, H: 432, pix: beyazZemin([[0.25, 0.2, 0.75, 0.8, [40, 60, 200, 255]]]) },
  // F2 kenardan kenara dolu (Pola sınıfı) — s<1 çıkar, EN_AZ=1 tabanına oturur, kaydırma 0
  { ad: 'F2-dolu', nw: 800, nh: 1200, W: 288, H: 432, pix: resim([120, 140, 90, 255], []) },
  // F3 geniş görsel (dh < H) — genişlikle sınırlı ölçek
  { ad: 'F3-genis', nw: 1200, nh: 600, W: 336, H: 504, pix: beyazZemin([[0.1, 0.3, 0.9, 0.7, [200, 30, 30, 255]]]) },
  // F4 uzun görsel (dh > H) — yüksekliğe sığdırılır, yükseklikle sınırlı ölçek
  { ad: 'F4-uzun', nw: 400, nh: 1000, W: 288, H: 432, pix: beyazZemin([[0.2, 0.1, 0.8, 0.9, K]]) },
  // F5 köşeye kaymış içerik — iki eksende de kaydırma
  { ad: 'F5-kose', nw: 1000, nh: 1000, W: 154, H: 231, pix: beyazZemin([[0.05, 0.6, 0.35, 0.95, [10, 120, 10, 255]]]) },
  // F6 minik içerik — ölçek EN_COK=3 tavanına dayanır
  { ad: 'F6-minik', nw: 1000, nh: 1000, W: 288, H: 432, pix: beyazZemin([[0.48, 0.48, 0.52, 0.52, [0, 0, 0, 255]]]) },
  // F7 bembeyaz — ölçülemez → 'yok'
  { ad: 'F7-beyaz', nw: 1000, nh: 1000, W: 288, H: 432, pix: beyazZemin([]) },
  // F8 şeffaf PNG — saydam zemin içerik sayılmaz
  { ad: 'F8-seffaf', nw: 1000, nh: 1000, W: 288, H: 432, pix: seffafZemin([[0.3, 0.3, 0.7, 0.7, [50, 50, 50, 255]]]) },
  // F9 alfa sınırı: alfa 16 koyu şerit içerik SAYILIR (sol), alfa 15 SAYILMAZ (sağ)
  {
    ad: 'F9-alfa-esik', nw: 1000, nh: 1000, W: 288, H: 432,
    pix: seffafZemin([
      [0.4, 0.4, 0.6, 0.6, [0, 0, 0, 255]],
      [0.05, 0.45, 0.1, 0.55, [0, 0, 0, 16]],
      [0.9, 0.45, 0.95, 0.55, [0, 0, 0, 15]],
    ]),
  },
  // F10 renk eşiği (ESIK 18): her kanal tek başına 19 sapınca içerik (sol R · üst G · sağ B), 18 sapan gri (alt) içerik DEĞİL
  {
    ad: 'F10-renk-esik', nw: 1000, nh: 1000, W: 288, H: 432,
    pix: beyazZemin([
      [0.4, 0.4, 0.6, 0.6, [0, 0, 0, 255]],
      [0.1, 0.45, 0.15, 0.55, [236, 255, 255, 255]],
      [0.45, 0.1, 0.55, 0.15, [255, 236, 255, 255]],
      [0.85, 0.45, 0.9, 0.55, [255, 255, 236, 255]],
      [0.45, 0.85, 0.55, 0.9, [237, 237, 237, 255]],
    ]),
  },
  // F11 içerik yalnız en sol sütunda (x1 = 0) — ölçülür, 'yok' DEĞİL
  { ad: 'F11-sol-sutun', nw: 640, nh: 640, W: 288, H: 432, pix: beyazZemin([[0, 0.3, 0.01, 0.7, K]]) },
  // F12 sola yaslı yarım içerik — satır sonu taşması (x <= w) yakalanır
  { ad: 'F12-sola-yasli', nw: 640, nh: 640, W: 288, H: 432, pix: beyazZemin([[0, 0.25, 0.5, 0.75, K]]) },
  // F13 çok ince yatay görsel — tuval yüksekliği round(0,32)=0 → Math.max(1, …) tabanı
  { ad: 'F13-ince-yatay', nw: 2000, nh: 10, W: 288, H: 432, pix: resim(K, []) },
  // F14 çok ince dikey görsel — tuval genişliği tabanı
  { ad: 'F14-ince-dikey', nw: 10, nh: 2000, W: 288, H: 432, pix: resim(K, []) },
  // F15 kesirli kenarlı geniş görsel — tuval çözünürlüğü (Math.max(nw, nh)) sonuca yansır
  { ad: 'F15-kesirli', nw: 1200, nh: 700, W: 154, H: 231, pix: beyazZemin([[0.123, 0.271, 0.877, 0.733, [90, 20, 140, 255]]]) },
  // F16 yüksekliği 0 bildiren görsel (nh = 0) — ölçülemez → 'yok'
  { ad: 'F16-nh0', nw: 100, nh: 0, W: 288, H: 432, pix: resim(K, []) },
  // F17 contain eşitlik kenarı: W / oran === H birebir (46×141 kap, 46×141 görsel, tuval 21×64, kutu x 4–17 · y 7–42).
  // `dh > H` yerine `>=` yazılırsa dw = H·oran yolu 1 ulp sapar ve dikey kaydırma 14.438% → 14.437% yuvarlanır.
  { ad: 'F17-esitlik-kenari', nw: 46, nh: 141, W: 46, H: 141, pix: beyazZemin([[4 / 21, 7 / 64, 18 / 21, 43 / 64, K]]) },
];

export type Iz = Record<string, unknown>;

/** Tek senaryo: betiği koşturur, sonra `adim` ile olay sırasını oynatır, çıktıyı döner. */
export function senaryo(src: string, sec: KurSecenek, gorseller: GorselTanim[], adim?: (o: ReturnType<typeof kur>, g: Gorsel[]) => void) {
  const o = kur(src, sec);
  const g = gorseller.map((t) => o.ekle(t));
  o.calistir();
  if (adim) adim(o, g);
  return {
    cikti: o.cikti(),
    hatalar: o.hatalar.slice(),
    raf: o.sayac.raf,
    mo: o.mo ? { ...o.mo.secenek, kokte: o.mo.hedef === o.belge.documentElement } : null,
    dcl: (o.belgeDinleyici.DOMContentLoaded ?? []).length,
    resize: (o.pencereDinleyici.resize ?? []).length,
  };
}

const F = (ad: string) => {
  const f = FIKSTUR.find((x) => x.ad === ad);
  if (!f) throw new Error('fikstür yok: ' + ad);
  return f;
};

/** Bütün deterministik senaryolar — davranış izinin tamamı. */
export function izler(src: string): Record<string, Iz> {
  const iz: Record<string, Iz> = {};
  // S1 temel: bütün fikstürler sayfada hazır, betik defer ile (interactive) koşar, ardından DOMContentLoaded
  iz.S1 = senaryo(src, {}, FIKSTUR, (o) => o.dcl());
  // S2 kapatma anahtarı — devre dışı / devrede kalması gereken adresler
  for (const q of ['?via_kirp=0', '?q=x&via_kirp=0', '?via_kirp=0&q=x', '?via_kirp=00', '?xvia_kirp=0', '?via_kirp=01', '?q=via_kirp=0', ''])
    iz['S2 ' + (q || '(boş)')] = senaryo(src, { search: q }, [F('F1-kare-paket')], (o) => o.dcl());
  // S3 geç yükleme: henüz yüklenmemiş (nw 0) ve kademeli (complete=false, nw>0) görsel; load sonrası ölçülür
  iz.S3 = senaryo(src, {}, [{ ...F('F1-kare-paket'), ad: 'gec', complete: false }], (o, g) => {
    o.dcl();
    (iz as Record<string, Iz>)['S3-once'] = { cikti: o.cikti() };
    o.yukle(g[0]!);
  });
  // naturalWidth > 0 ama yükleme bitmedi (kademeli JPEG): load gelene kadar ölçülmez
  iz['S3-kademeli'] = senaryo(src, {}, [{ ...F('F5-kose'), ad: 'kademeli', complete: 'kademeli' }], (o, g) => {
    o.dcl();
    o.moTetikle();
    o.rafCalistir();
    (iz as Record<string, Iz>)['S3-kademeli-once'] = { cikti: o.cikti() };
    o.yukle(g[0]!);
  });
  // S4 kırık görsel: complete=true, naturalWidth=0 → dokunulmaz, 'yok' bile yazılmaz
  iz.S4 = senaryo(src, {}, [{ ...F('F1-kare-paket'), ad: 'kirik', nw: 0, nh: 0 }], (o) => o.dcl());
  // S5 sonradan eklenen kartlar (sonsuz kaydırma / filtre): iki gözlemci çağrısı tek kare → tek rAF
  iz.S5 = senaryo(src, {}, [], (o) => {
    o.dcl();
    o.ekle(F('F1-kare-paket'));
    o.ekle(F('F5-kose'));
    o.moTetikle();
    o.moTetikle();
    const ara = { raf: o.sayac.raf, cikti: o.cikti() };
    o.rafCalistir();
    o.moTetikle();
    o.rafCalistir();
    (iz as Record<string, Iz>)['S5-ara'] = ara;
  });
  // S6 bağlama tekilliği: üç tarama turunda görsele tek load dinleyicisi
  iz.S6 = senaryo(src, {}, [F('F1-kare-paket')], (o) => {
    o.dcl();
    for (let i = 0; i < 3; i++) {
      o.moTetikle();
      o.rafCalistir();
    }
  });
  // S7 yeniden boyutlama: ilk sırada ölçülemeyen ('yok') görsel, kap oranı değişen görsel, gizliyken ölçülen görseller
  iz.S7 = senaryo(
    src,
    {},
    [F('F7-beyaz'), F('F1-kare-paket'), { ...F('F5-kose'), ad: 'gizli-W0', W: 0, H: 231 }, { ...F('F3-genis'), ad: 'gizli-H0', W: 336, H: 0 }],
    (o, g) => {
      o.dcl();
      (iz as Record<string, Iz>)['S7-once'] = { cikti: o.cikti() };
      o.boyutla(g[1]!, 300, 300);
      o.boyutla(g[2]!, 154, 231);
      o.boyutla(g[3]!, 336, 504);
      o.resize();
      o.resize(); // ikinci olay ilk zamanlayıcıyı iptal eder
      o.zamanlayiciCalistir();
    },
  );
  // S8 2B bağlam yok · S9 tuval okunamıyor (CORS) → hepsi 'yok', hata yok
  iz.S8 = senaryo(src, { ctxYok: true }, [F('F1-kare-paket'), F('F2-dolu')], (o) => o.dcl());
  iz.S9 = senaryo(src, { okumaHatasi: true }, [F('F1-kare-paket'), F('F2-dolu')], (o) => o.dcl());
  // S10 belge durumu: 'loading' → DOMContentLoaded'a kadar beklenir · 'complete' → hemen taranır
  iz.S10 = senaryo(src, { readyState: 'loading' }, [F('F1-kare-paket')], (o) => {
    (iz as Record<string, Iz>)['S10-once'] = { cikti: o.cikti() };
    o.dcl();
  });
  iz.S11 = senaryo(src, { readyState: 'complete' }, [F('F1-kare-paket')]);
  return iz;
}

/** Eşdeğerlik taraması için tohumlu rastgele görseller (sınır durumları dahil). Çiviye girmez. */
export function tarama(src: string, n = 400, tohum = 995332) {
  let t = tohum >>> 0;
  const r = () => ((t = (t * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const tam = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const kaplar: Array<[number, number]> = [[288, 432], [336, 504], [154, 231], [105.6, 158.4], [300, 300], [432, 288]];
  const out: unknown[] = [];
  for (let i = 0; i < n; i++) {
    const nw = tam(1, 2400), nh = tam(1, 2400);
    const x0 = r() * 0.6, y0 = r() * 0.6, x1 = x0 + r() * (1 - x0), y1 = y0 + r() * (1 - y0);
    const sinir = [r() < 0.5 ? 236 : 237, tam(0, 255), tam(0, 255)] as const;
    const renk: Piksel = r() < 0.3 ? [sinir[0], 255, 255, 255] : [tam(0, 255), tam(0, 255), tam(0, 255), r() < 0.2 ? tam(14, 18) : 255];
    const zemin: Piksel = r() < 0.2 ? SEFFAF : BEYAZ;
    let [W, H] = kaplar[tam(0, kaplar.length - 1)]!;
    if (r() < 0.15) { W = tam(50, 400); H = W / (nw / nh); } // dh === H eşitlik kenarı (betiğin kendi işlem sırası)
    const fn = resim(zemin, [[x0, y0, x1, y1, renk]]);
    const s = senaryo(src, {}, [{ ad: 't' + i, nw, nh, W, H, pix: fn }], (o) => o.dcl());
    out.push([i, s.cikti[0]?.scale, s.cikti[0]?.translate, s.cikti[0]?.kirp, s.hatalar.join('|')]);
  }
  return out;
}
