/**
 * #995332 · E9 — BASIM BETİĞİNİN (bas.py) ÇİVİSİ.
 * bas.py CANLI temaya yazan betiktir; kapılarının hiçbir testi yoktu. Bu çivi betiği SAHTE Shopify katmanında
 * (kart-gorsel-basim.sahte.py: urlopen yakalanır, soket bağlantısı yasak, sleep etkisiz, paket GEÇİCİ KOPYADA)
 * koşturur ve her kapıyı iki yönüyle ölçer: geçmesi gereken yerde geçer (POZİTİF), durması gereken yerde DUR der
 * ve HİÇBİR yazma isteği göndermez (NEGATİF).
 * Kapılar: G1 canlı yazma (L43-57) · G2 SIFIRLA canlıda koşmaz (L58-59) · G3 canlı tabanı = ÖNCESİ (L60-62) ·
 * G4 tema = ÖNCESİ (L70-75) · G5 yama md5 (L76-77) · G6 GET-back + otomatik geri alma (L27-31, L80-94) ·
 * G7 KIP=GERI (L33-41) · G8 HTTP katmanı (L19-24).
 * MUTASYON: bas.py'nin herhangi bir karar noktası çevrilirse bu dosyadaki en az bir iddia KIRILIR —
 * envanter: raporlar/995332-e9-basim-civisi-20261101.md. «E12» notlu iddialar bugünkü davranışı SABİTLER;
 * kusur olarak raporlandılar, düzeltme kararı koordinasyonda.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const P = path.join(__dirname, '..', 'tema-yamalari', '995332-kart-gorsel');
const SAHTE = path.join(__dirname, 'kart-gorsel-basim.sahte.py');
const M = JSON.parse(readFileSync(path.join(P, 'md5.json'), 'utf8')) as Record<string, { once: string | null; sonra: string }>;
const CANLI = '195348856964';
const ONZ = '500'; // verilmiş önizleme teması
const KOPYA = '197000000001'; // sahte themeDuplicate'in döndürdüğü tema
const JS = 'assets/via-kart-gorsel.js';
const CSS = 'assets/via-product-overrides.css';
const KOL = 'sections/via-koleksiyon-v2.liquid';
const LAY = 'layout/theme.liquid';
const KISA: Record<string, string> = { [JS]: 'JS', [CSS]: 'CSS', [KOL]: 'KOL', [LAY]: 'LAY' };

type Hal = 'once' | 'sonra' | 'baska';
type Tema = Partial<Record<string, Hal>>;
type Senaryo = {
  env?: Record<string, string>;
  temalar?: Record<string, Tema>;
  bayat?: Record<string, number>;
  boz_yaz?: string[];
  put_hata?: string[];
  get_hata?: string[];
  dup?: { userErrors?: unknown[]; role?: string; isleme?: number; gql_hata?: boolean };
  yama_boz?: string[];
  dosya_ek?: Record<string, string>;
  ag_dene?: boolean;
};
type Istek = { y: string; t?: string; k?: string; id?: string };
type Sonuc = { cikis: number | string; cikti: string[]; istek: Istek[]; ag: string[]; son: Record<string, Record<string, string>> };

/** ÖNCESİ = canlının bugünkü hâli: 3 dosya ÖNCESİ md5'inde, yeni JS YOK. */
const ONCESI: Tema = { [CSS]: 'once', [KOL]: 'once', [LAY]: 'once' };
const SONRASI: Tema = { [JS]: 'sonra', [CSS]: 'sonra', [KOL]: 'sonra', [LAY]: 'sonra' };
const SON_ONCESI = { [CSS]: 'once', [KOL]: 'once', [LAY]: 'once' };
const SON_SONRASI = { [JS]: 'sonra', [CSS]: 'sonra', [KOL]: 'sonra', [LAY]: 'sonra' };

const kos = (s: Senaryo): Sonuc => {
  const r = JSON.parse(
    execFileSync('python3', [SAHTE, P, JSON.stringify(s)], {
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, // tema-yamalari altına __pycache__ bırakmaz
    }),
  ) as Sonuc;
  if (!s.ag_dene) expect(r.ag).toEqual([]); // hiçbir senaryoda gerçek ağa çıkılmaz
  return r;
};
/** Yazma istekleri (PUT/DELETE) sırasıyla: `PUT <tema> <dosya>`. */
const yazma = (r: Sonuc) => r.istek.filter((i) => i.y === 'PUT' || i.y === 'DELETE').map((i) => `${i.y} ${i.t} ${KISA[i.k!]}`);
const temaIstek = (r: Sonuc, t: string) => r.istek.filter((i) => i.t === t);
const sorgu = (r: Sonuc) => r.istek.filter((i) => i.y === 'SORGU').length;
const basim = (t: string) => [JS, CSS, KOL, LAY].map((k) => `PUT ${t} ${KISA[k]}`);

describe('#995332 E9 · sahte katman', () => {
  it('ağ gerçekten kapalı: soket açma denemesi yakalanır ve raporlanır', () => {
    const r = kos({ ag_dene: true, env: { KIP: 'CANLI' }, temalar: { [CANLI]: ONCESI } });
    expect(r.ag).toHaveLength(1);
    expect(r.cikis).toBe(0);
  });
});

describe('#995332 E9 · G1 canlı yazma kapısı (L43-57)', () => {
  it('POZİTİF: KIP=CANLI + canlı ÖNCESİ 4/4 → 4 dosya SIRA ile canlıya basılır, her biri GET-back OK, çıkış 0', () => {
    const r = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: ONCESI } });
    expect(r.cikis).toBe(0);
    expect(yazma(r)).toEqual(basim(CANLI));
    expect(r.son[CANLI]).toEqual(SON_SONRASI);
    expect(r.cikti.filter((c) => c.startsWith('PUT '))).toEqual([JS, CSS, KOL, LAY].map((k) => `PUT ${k} 200 GET-BACK OK`));
    expect(r.cikti.at(-1)).toBe(`BASIM TAMAM tema ${CANLI} · önizleme: https://viamood.com.tr/search?q=how+wheels+premium&preview_theme_id=${CANLI}`);
    expect(r.istek.some((i) => i.y === 'DUP')).toBe(false);
    // ön kapı 4 GET + her dosya PUT ve TEK GET-back: doğru değer ilk okumada gelince bekleme erken biter
    expect(r.istek.map((i) => i.y)).toEqual([...Array(4).fill('GET'), ...Array(4).fill(['PUT', 'GET']).flat()]);
  });

  it('POZİTİF: ONIZLEME_ID verilince YALNIZ o temaya yazılır; canlıya tek istek bile gitmez', () => {
    const r = kos({ env: { ONIZLEME_ID: ONZ }, temalar: { [CANLI]: ONCESI, [ONZ]: ONCESI } });
    expect(r.cikis).toBe(0);
    expect(yazma(r)).toEqual(basim(ONZ));
    expect(temaIstek(r, CANLI)).toEqual([]);
    expect(r.son[CANLI]).toEqual(SON_ONCESI);
  });

  it('POZİTİF: KURU=1 (kip/kimlik yok) → kopya açılmaz, canlı yalnız OKUNUR, yazma 0, çıkış 0', () => {
    const r = kos({ env: { KURU: '1' }, temalar: { [CANLI]: ONCESI } });
    expect(r.cikis).toBe(0);
    expect(r.cikti[0]).toBe('KURU: kopya açılmadı, kapılar canlı üzerinde OKUNARAK ölçülüyor');
    expect(r.cikti.at(-1)).toBe('KURU: PUT YOK');
    expect(r.istek.map((i) => i.y)).toEqual(['GET', 'GET', 'GET', 'GET']);
    expect(temaIstek(r, CANLI)).toHaveLength(4);
  });

  it('POZİTİF: KIP=CANLI KURU=1 → kapılar koşar, yazma 0', () => {
    const r = kos({ env: { KIP: 'CANLI', KURU: '1' }, temalar: { [CANLI]: ONCESI } });
    expect(r.cikis).toBe(0);
    expect(r.cikti).toEqual([...[JS, CSS, KOL, LAY].map((k) => `ON-KAPI OK ${k}`), 'KURU: PUT YOK']);
    expect(yazma(r)).toEqual([]);
  });

  it('NEGATİF: canlı kimliği ONIZLEME_ID olarak verilirse (KIP≠CANLI) DUR — hiçbir istek gitmez', () => {
    const envler: Array<Record<string, string>> = [{ ONIZLEME_ID: CANLI }, { KIP: 'ONIZLEME', ONIZLEME_ID: CANLI, SIFIRLA: '1' }, { KIP: 'canli', ONIZLEME_ID: CANLI }];
    for (const env of envler) {
      const r = kos({ env, temalar: { [CANLI]: ONCESI } });
      expect(r.cikis).toBe('DUR: canlıya yalnız KIP=CANLI ile yazılır');
      expect(r.istek).toEqual([]);
    }
  });

  it('POZİTİF: kimlik verilmezse canlının KOPYASI açılır, yalnız kopyaya yazılır (kip varsayılanı ONIZLEME)', () => {
    const r = kos({ temalar: { [CANLI]: ONCESI }, dup: { isleme: 2 } });
    expect(r.cikis).toBe(0);
    expect(r.istek[0]).toEqual({ y: 'DUP', id: `gid://shopify/OnlineStoreTheme/${CANLI}` });
    expect(r.cikti.slice(0, 2)).toEqual([`ONIZLEME_TEMA ${KOPYA}`, "KOPYA HAZIR {'processing': False, 'role': 'UNPUBLISHED'}"]);
    expect(sorgu(r)).toBe(3);
    expect(yazma(r)).toEqual(basim(KOPYA));
    expect(temaIstek(r, CANLI)).toEqual([]);
    expect(r.son[CANLI]).toEqual(SON_ONCESI);
  });

  it('NEGATİF: kopya hatası (userErrors · GQL hatası · rol MAIN) → DUR, tek tema dosyası istenmez', () => {
    const ue = kos({ temalar: { [CANLI]: ONCESI }, dup: { userErrors: [{ field: 'id', message: 'x' }] } });
    expect(ue.cikis).toBe('DUP [{"field": "id", "message": "x"}]');
    const gq = kos({ temalar: { [CANLI]: ONCESI }, dup: { gql_hata: true } });
    expect(gq.cikis).toBe('GQL [{"message": "sahte gql hatas\\u0131"}]'); // bas.py json.dumps: ensure_ascii
    const ana = kos({ temalar: { [CANLI]: ONCESI }, dup: { role: 'MAIN' } });
    expect(ana.cikis).toBe('DUR: kopya MAIN görünüyor');
    for (const r of [ue, gq, ana]) expect(r.istek.filter((i) => i.t)).toEqual([]);
  });

  it('kopya bekleme sınırı 60 sorgu: 59 sorgu işlenirken 60.da hazır → beklenir', () => {
    const r = kos({ temalar: { [CANLI]: ONCESI }, dup: { isleme: 59 } });
    expect(sorgu(r)).toBe(60);
    expect(r.cikti[1]).toBe("KOPYA HAZIR {'processing': False, 'role': 'UNPUBLISHED'}");
    expect(yazma(r)).toEqual(basim(KOPYA));
  });

  it('E12 · bugünkü davranış: kopya 60 sorguda hâlâ işleniyorsa betik DURMAZ, işlenen kopyaya yazar', () => {
    const r = kos({ temalar: { [CANLI]: ONCESI }, dup: { isleme: 999 } });
    expect(sorgu(r)).toBe(60);
    expect(r.cikti[1]).toBe("KOPYA HAZIR {'processing': True, 'role': 'UNPUBLISHED'}");
    expect(yazma(r)).toEqual(basim(KOPYA));
    expect(temaIstek(r, CANLI)).toEqual([]);
  });
});

describe('#995332 E9 · G2 SIFIRLA canlıda koşmaz (L58-59)', () => {
  it('NEGATİF: KIP=CANLI SIFIRLA=1 ve KURU yolundan gelen canlı (KURU=1 SIFIRLA=1) → DUR, hiçbir istek gitmez', () => {
    const envler: Array<Record<string, string>> = [{ KIP: 'CANLI', SIFIRLA: '1' }, { KURU: '1', SIFIRLA: '1' }, { KIP: 'CANLI', KURU: '1', SIFIRLA: '1' }];
    for (const env of envler) {
      const r = kos({ env, temalar: { [CANLI]: ONCESI } });
      expect(r.cikis).toBe('DUR: SIFIRLA canlıda koşmaz');
      expect(r.istek).toEqual([]);
    }
  });

  it('POZİTİF: önizleme SONRASI 4/4 → önce ÖNCESİ\'ne sıfırlanır (JS silinir), sonra yeniden basılır', () => {
    const r = kos({ env: { ONIZLEME_ID: ONZ, SIFIRLA: '1' }, temalar: { [CANLI]: ONCESI, [ONZ]: SONRASI } });
    expect(r.cikis).toBe(0);
    expect(yazma(r)).toEqual([`DELETE ${ONZ} JS`, `PUT ${ONZ} CSS`, `PUT ${ONZ} KOL`, `PUT ${ONZ} LAY`, ...basim(ONZ)]);
    expect(r.cikti.slice(0, 4)).toEqual([`SIFIRLA ${JS} SIL True`, `SIFIRLA ${CSS} True`, `SIFIRLA ${KOL} True`, `SIFIRLA ${LAY} True`]);
    expect(r.son[ONZ]).toEqual(SON_SONRASI);
    expect(yazma(r).filter((y) => y.includes(CANLI))).toEqual([]);
  });

  it('POZİTİF: zaten ÖNCESİ olan dosya sıfırlamada YAZILMAZ; SIFIRLA yoksa sıfırlama hiç koşmaz', () => {
    const r = kos({ env: { ONIZLEME_ID: ONZ, SIFIRLA: '1' }, temalar: { [CANLI]: ONCESI, [ONZ]: { [JS]: 'baska', [CSS]: 'baska', [KOL]: 'baska', [LAY]: 'once' } } });
    expect(yazma(r).slice(0, 3)).toEqual([`DELETE ${ONZ} JS`, `PUT ${ONZ} CSS`, `PUT ${ONZ} KOL`]);
    expect(yazma(r).slice(3)).toEqual(basim(ONZ));
    const yok = kos({ env: { ONIZLEME_ID: ONZ }, temalar: { [CANLI]: { [CSS]: 'baska' }, [ONZ]: SONRASI } });
    expect(yok.cikis).toBe(0);
    expect(yok.cikti).toEqual([...[JS, CSS, KOL, LAY].map((k) => `ZATEN-BASILI ${k}`), `BASIM TAMAM tema ${ONZ} · önizleme: https://viamood.com.tr/search?q=how+wheels+premium&preview_theme_id=${ONZ}`]);
    expect(yok.istek).toHaveLength(4);
  });

  it('POZİTİF: SIFIRLA + KURU → farkı yazar, hiçbir şey yazmaz', () => {
    const r = kos({ env: { ONIZLEME_ID: ONZ, SIFIRLA: '1', KURU: '1' }, temalar: { [CANLI]: ONCESI, [ONZ]: { [JS]: 'sonra', [CSS]: 'once', [KOL]: 'once', [LAY]: 'once' } } });
    expect(r.cikis).toBe(0);
    expect(yazma(r)).toEqual([]);
    expect(r.cikti).toEqual([
      `KURU SIFIRLA (yazılmadı) ${JS} ${M[JS]!.sonra} → None`,
      `ZATEN-BASILI ${JS}`,
      ...[CSS, KOL, LAY].map((k) => `ON-KAPI OK ${k}`),
      'KURU: PUT YOK',
    ]);
  });
});

describe('#995332 E9 · G3 canlı tabanı = ÖNCESİ (L60-62)', () => {
  it('NEGATİF: canlıda bir dosya ÖNCESİ değil / yeni JS zaten var / dosya yok → DUR, çıkış 1, yazma 0', () => {
    const durumlar: Array<[Tema, string]> = [
      [{ ...ONCESI, [CSS]: 'baska' }, `DUR: canlı tabanı != ÖNCESİ ${CSS} `],
      [{ ...ONCESI, [JS]: 'sonra' }, `DUR: canlı tabanı != ÖNCESİ ${JS} ${M[JS]!.sonra}`],
      [{ [CSS]: 'once', [KOL]: 'once' }, `DUR: canlı tabanı != ÖNCESİ ${LAY} None`],
    ];
    for (const [canli, mesaj] of durumlar) {
      const r = kos({ env: { ONIZLEME_ID: ONZ, SIFIRLA: '1' }, temalar: { [CANLI]: canli, [ONZ]: SONRASI } });
      expect(r.cikis).toBe(1);
      expect(r.cikti).toHaveLength(1);
      expect(r.cikti[0]!.startsWith(mesaj)).toBe(true);
      expect(yazma(r)).toEqual([]);
      expect(temaIstek(r, ONZ)).toEqual([]);
    }
  });
});

describe('#995332 E9 · G4 tema = ÖNCESİ (L70-75)', () => {
  it('NEGATİF: canlıda SON dosya bile ÖNCESİ değilse ilk üçü geçse de HİÇBİR PUT gitmez', () => {
    const r = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: { ...ONCESI, [LAY]: 'baska' } } });
    expect(r.cikis).toBe(1);
    expect(r.cikti.at(-1)).toMatch(new RegExp(`^DUR: tema ${CANLI} ${LAY} [0-9a-f]{32} != ÖNCESİ ${M[LAY]!.once}$`));
    expect(r.cikti.filter((c) => c.startsWith('ON-KAPI OK'))).toHaveLength(3);
    expect(yazma(r)).toEqual([]);
  });

  it('NEGATİF: yabancı JS / eksik dosya → ilk bozuk dosyada DUR', () => {
    const js = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: { ...ONCESI, [JS]: 'baska' } } });
    expect(js.cikis).toBe(1);
    expect(js.cikti).toHaveLength(1);
    expect(js.istek).toHaveLength(1);
    const eksik = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: { [KOL]: 'once', [LAY]: 'once' } } });
    expect(eksik.cikti.at(-1)).toBe(`DUR: tema ${CANLI} ${CSS} None != ÖNCESİ ${M[CSS]!.once}`);
    expect(yazma(eksik)).toEqual([]);
  });

  it('POZİTİF: zaten SONRASI olan dosya atlanır (ZATEN-BASILI), yalnız kalanlar basılır; hepsi basılıysa yazma 0', () => {
    const r = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: { [JS]: 'sonra', [CSS]: 'sonra', [KOL]: 'once', [LAY]: 'once' } } });
    expect(r.cikis).toBe(0);
    expect(r.cikti.slice(0, 2)).toEqual([`ZATEN-BASILI ${JS}`, `ZATEN-BASILI ${CSS}`]);
    expect(yazma(r)).toEqual([`PUT ${CANLI} KOL`, `PUT ${CANLI} LAY`]);
    expect(r.son[CANLI]).toEqual(SON_SONRASI);
    const hep = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: SONRASI } });
    expect(hep.cikis).toBe(0);
    expect(yazma(hep)).toEqual([]);
  });
});

describe('#995332 E9 · G5 yama md5 kapısı (L76-77)', () => {
  it('NEGATİF: yama çıktısı md5.json SONRASI ile tutmazsa (CSS · LAY · YENI JS) DUR, hiçbir PUT gitmez', () => {
    const durumlar: Array<[Senaryo, string]> = [
      [{ yama_boz: [CSS] }, CSS],
      [{ yama_boz: [LAY] }, LAY],
      [{ dosya_ek: { 'YENI/assets__via-kart-gorsel.js': '\n' } }, JS],
    ];
    for (const [ek, k] of durumlar) {
      const r = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: ONCESI }, ...ek });
      expect(r.cikis).toBe(1);
      expect(r.cikti.at(-1)).toBe(`DUR: yama md5 ${k}`);
      expect(yazma(r)).toEqual([]);
      expect(r.son[CANLI]).toEqual(SON_ONCESI);
    }
  });

  it('POZİTİF: yeni JS paketteki YENI dosyasından, var olan dosyalar yama.uygula ile üretilir', () => {
    // ÖNCESİ kopyasını bozmak yalnız SIFIRLA/GERI yolunu etkiler; basım içeriği temadan okunur.
    const r = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: ONCESI }, dosya_ek: { 'ONCESI/layout__theme.liquid': 'x' } });
    expect(r.cikis).toBe(0);
    expect(r.son[CANLI]).toEqual(SON_SONRASI);
  });
});

describe('#995332 E9 · G6 GET-back + otomatik geri alma (L27-31, L80-94)', () => {
  it('NEGATİF: 3. dosyanın GET-back md5\'i tutmazsa basılan üç dosya TERS sırayla eski içeriğe döner, çıkış 1', () => {
    const r = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: ONCESI }, boz_yaz: [KOL] });
    expect(r.cikis).toBe(1);
    expect(yazma(r)).toEqual([`PUT ${CANLI} JS`, `PUT ${CANLI} CSS`, `PUT ${CANLI} KOL`, `PUT ${CANLI} KOL`, `PUT ${CANLI} CSS`, `DELETE ${CANLI} JS`]);
    expect(r.cikti.find((c) => c.startsWith(`PUT ${KOL}`))).toMatch(/GET-BACK !![0-9a-f]{32}$/);
    expect(r.cikti.slice(-4)).toEqual([`HATA RuntimeError('get-back ${KOL}') → GERI-ALMA`, `GERI ${KOL}`, `GERI ${CSS}`, `GERI ${JS}`]);
    expect(r.istek.filter((i) => i.y === 'GET' && i.k === KOL)).toHaveLength(1 + 12); // ön kapı + 12 deneme
    expect(r.son[CANLI]).toEqual(SON_ONCESI);
  });

  it('NEGATİF: PUT HTTP 500 → yalnız gerçekten basılanlar geri alınır (CSS yazılmadı, JS silinir)', () => {
    const r = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: ONCESI }, put_hata: [CSS] });
    expect(r.cikis).toBe(1);
    expect(yazma(r)).toEqual([`PUT ${CANLI} JS`, `PUT ${CANLI} CSS`, `DELETE ${CANLI} JS`]);
    expect(r.cikti.slice(-2)).toEqual([`HATA <HTTPError 500: 'sahte'> → GERI-ALMA`, `GERI ${JS}`]);
    expect(r.son[CANLI]).toEqual(SON_ONCESI);
  });

  it('NEGATİF: ilk dosya bozulursa yalnız o geri alınır; ZATEN-BASILI dosyaya geri almada dokunulmaz', () => {
    const ilk = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: ONCESI }, boz_yaz: [JS] });
    expect(yazma(ilk)).toEqual([`PUT ${CANLI} JS`, `DELETE ${CANLI} JS`]);
    expect(ilk.son[CANLI]).toEqual(SON_ONCESI);
    const kar = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: { [JS]: 'sonra', [CSS]: 'once', [KOL]: 'once', [LAY]: 'once' } }, boz_yaz: [LAY] });
    expect(kar.cikis).toBe(1);
    expect(yazma(kar)).toEqual([`PUT ${CANLI} CSS`, `PUT ${CANLI} KOL`, `PUT ${CANLI} LAY`, `PUT ${CANLI} LAY`, `PUT ${CANLI} KOL`, `PUT ${CANLI} CSS`]);
    expect(kar.son[CANLI]).toEqual({ [JS]: 'sonra', ...SON_ONCESI });
  });

  it('GET-back bekleme sınırı 12 okuma: 11 bayat okumadan sonra doğru → geçer; 12 bayat → geri alınır', () => {
    const on1 = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: ONCESI }, bayat: { [CSS]: 11 } });
    expect(on1.cikis).toBe(0);
    expect(on1.istek.filter((i) => i.y === 'GET' && i.k === CSS)).toHaveLength(1 + 12);
    expect(on1.son[CANLI]).toEqual(SON_SONRASI);
    const on2 = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: ONCESI }, bayat: { [CSS]: 12 } });
    expect(on2.cikis).toBe(1);
    expect(on2.cikti.find((c) => c.startsWith(`PUT ${CSS}`))).toBe(`PUT ${CSS} 200 GET-BACK !!${M[CSS]!.once}`);
    expect(yazma(on2)).toEqual([`PUT ${CANLI} JS`, `PUT ${CANLI} CSS`, `PUT ${CANLI} CSS`, `DELETE ${CANLI} JS`]);
  });

  it('GET-back sırasında okuma 404 dönerse (yeni JS görünmüyor) md5 None sayılır ve geri alınır', () => {
    const r = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: ONCESI }, bayat: { [JS]: 99 } });
    expect(r.cikis).toBe(1);
    expect(r.cikti).toContain(`PUT ${JS} 200 GET-BACK !!None`);
    expect(yazma(r)).toEqual([`PUT ${CANLI} JS`, `DELETE ${CANLI} JS`]);
  });
});

describe('#995332 E9 · G7 KIP=GERI (L33-41)', () => {
  it('POZİTİF: SONRASI 4/4 tema (canlı dahil) ÖNCESİ\'ne döner: JS silinir, 3 dosya ÖNCESİ, çıkış 0', () => {
    for (const t of [ONZ, CANLI]) {
      const r = kos({ env: { KIP: 'GERI', TEMA_ID: t }, temalar: { [t]: SONRASI } });
      expect(r.cikis).toBe(0);
      expect(yazma(r)).toEqual([`DELETE ${t} JS`, `PUT ${t} CSS`, `PUT ${t} KOL`, `PUT ${t} LAY`]);
      expect(r.cikti).toEqual([`GERI ${JS} SIL True`, `GERI ${CSS} True`, `GERI ${KOL} True`, `GERI ${LAY} True`]);
      expect(r.son[t]).toEqual(SON_ONCESI);
    }
  });

  it('POZİTİF: zaten ÖNCESİ olan dosyalar yazılmaz (ZATEN-ONCESI)', () => {
    const r = kos({ env: { KIP: 'GERI', TEMA_ID: ONZ }, temalar: { [ONZ]: { [JS]: 'sonra', [CSS]: 'once', [KOL]: 'sonra', [LAY]: 'once' } } });
    expect(r.cikis).toBe(0);
    expect(yazma(r)).toEqual([`DELETE ${ONZ} JS`, `PUT ${ONZ} KOL`]);
    expect(r.cikti.filter((c) => c.startsWith('ZATEN-ONCESI'))).toEqual([`ZATEN-ONCESI ${CSS}`, `ZATEN-ONCESI ${LAY}`]);
  });

  it('NEGATİF: dosya ne ÖNCESİ ne SONRASI → DUR, çıkış 1 (E12: o ana dek dönenler dönmüş kalır)', () => {
    const r = kos({ env: { KIP: 'GERI', TEMA_ID: ONZ }, temalar: { [ONZ]: { ...SONRASI, [KOL]: 'baska' } } });
    expect(r.cikis).toBe(1);
    expect(r.cikti.at(-1)).toMatch(new RegExp(`^DUR: ne öncesi ne sonrası ${KOL} [0-9a-f]{32}$`));
    expect(yazma(r)).toEqual([`DELETE ${ONZ} JS`, `PUT ${ONZ} CSS`]);
  });

  it('E12 · bugünkü davranış: GERI GET-back tutmazsa yalnız «False» yazar (çıkış kodu kapı değil); KURU dikkate alınmaz', () => {
    const r = kos({ env: { KIP: 'GERI', TEMA_ID: ONZ }, temalar: { [ONZ]: SONRASI }, bayat: { [CSS]: 99 } });
    expect(r.cikti[1]).toBe(`GERI ${CSS} False`);
    const k = kos({ env: { KIP: 'GERI', TEMA_ID: ONZ, KURU: '1' }, temalar: { [ONZ]: SONRASI } });
    expect(yazma(k)).toHaveLength(4);
  });
});

describe('#995332 E9 · G8 HTTP katmanı (L19-24)', () => {
  it('NEGATİF: okuma 404 dışı hata verirse istisna yükselir, hiçbir yazma gitmez', () => {
    const r = kos({ env: { KIP: 'CANLI' }, temalar: { [CANLI]: ONCESI }, get_hata: [CSS] });
    expect(r.cikis).toBe("ISTISNA HTTPError HTTP Error 500: sahte");
    expect(yazma(r)).toEqual([]);
  });
});
