/**
 * #994831 · AÇIKLAMASI BAŞKA ÜRÜNÜ ANLATAN ÜRÜNLER · ÇİVİ.
 * Girdiler: veri/994831-aciklama-degistir.jsonl (oncekiHtml = canlı açıklamanın birebir kopyası, Admin API 31 Eki 2026).
 * MUTASYON: öncesi kapısı, çelişki kapısı, metin kapısı (eşlemenin birebir çıktısı), yanlış ad kapısı, kaynak şartı,
 * kalite yedeği, yeniden okuma ya da dry-run kaldırılırsa ilgili iddialar KIRILIR.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { adGecer, degistirCalistir, eslemdenHtml, karar, yanlisCumleleriCikar, type Giris, type KutukSatiri } from '../src/lib/aciklama-degistir';
import { duzMetin } from '../src/lib/aciklama-ic-not';
import { karar as ekleKarar, type Giris as EkleGiris } from '../src/lib/aciklama-ekle';

const satir = <X,>(f: string) => readFileSync(path.join(__dirname, '..', 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as X);
const G = satir<Giris>('994831-aciklama-degistir.jsonl');
const ROCK = G.find((g) => g.handle === 'goojitzu-stretch-strikers-tekli-paket-blazagon-2')!;
const THRASH = G.find((g) => g.handle.endsWith('-thrash-vs-terrack'))!;
const kesin = (k: ReturnType<typeof karar>) => { if (k.durum !== 'yazilacak') throw new Error(`${k.durum}: ${'sebep' in k ? k.sebep : ''}`); return k; };

describe('veri ve kaynak şartı', () => {
  it('tam 2 ürün: Rock Jaw (eski metin Blazagon) · Thrash vs Terrack (eski metin seri asortisi)', () => {
    expect(G.map((g) => g.handle).sort()).toEqual([ROCK.handle, THRASH.handle].sort());
    expect(ROCK.oncekiHtml).toContain('Blazagon');
    expect(THRASH.oncekiHtml).toContain('Blazagon vs Shredz');
  });
  it('yeni HTML = kaynak eşlemesinin birebir çıktısı; her satır ≥1 kaynak; tür yalnız başlık/ürünün kendi ambalaj görseli', () => {
    for (const g of G) {
      expect(g.yeniHtml).toBe(eslemdenHtml(g.eslem));
      for (const e of g.eslem) {
        expect(e.kaynaklar.length, e.metin).toBeGreaterThan(0);
        for (const k of e.kaynaklar) {
          expect(['baslik', 'ambalaj']).toContain(k.tur);
          expect(k.alinti.trim().length).toBeGreaterThan(0);
          if (k.tur === 'ambalaj') expect(k.kaynak).toMatch(/^https:\/\/cdn\.shopify\.com\/s\/files\/1\/1006\/6021\/5940\/files\/\d+-\d+\.jpg$/);
          if (k.tur === 'baslik') for (const p of k.alinti.split(' · ')) expect(adGecer(g.baslik, p), p).toBe(true);
        }
      }
      expect(g.bosBirakilan!.length).toBeGreaterThan(0);
    }
  });
  it('eslemdenHtml dalga 2 düzeniyle aynı: dalga 2 Blazagon eki eşlemesinden birebir yeniden üretilir', () => {
    const d2 = satir<{ handle: string; ekHtml: string; eslem: Giris['eslem'] }>('994831-aciklama-dalga2.jsonl').find((x) => x.handle === 'goojitzu-stretch-strikers-tekli-paket-blazagon')!;
    expect(eslemdenHtml(d2.eslem)).toBe(d2.ekHtml);
  });
});

describe('karar', () => {
  it('canlı = öncesi iken yazılacak HTML = yeniHtml (kip değiştir); yanlış ad YOK, doğru ad VAR', () => {
    for (const g of G) {
      const k = kesin(karar(g, g.oncekiHtml));
      expect(k.kip).toBe('degistir');
      expect(k.html).toBe(g.yeniHtml);
      const d = duzMetin(k.html);
      for (const a of g.yanlisAdlar) expect(adGecer(d, a), `${g.handle} · ${a}`).toBe(false);
      for (const a of g.dogruAdlar) expect(adGecer(d, a), `${g.handle} · ${a}`).toBe(true);
    }
  });
  it('idempotans: canlı zaten yeni metinse (Shopify satır sonu ekleşe de) değişiklik-yok', () => {
    for (const g of G) {
      expect(karar(g, g.yeniHtml)).toMatchObject({ durum: 'degisiklik-yok' });
      expect(karar(g, g.yeniHtml.replace(/<ul>/g, '<ul>\n').replace(/<\/li>/g, '</li>\n').replace(/<tr>/g, '\n<tr>'))).toMatchObject({ durum: 'degisiklik-yok' });
    }
  });
  it('NEGATİF: canlı öncesinden farklıysa (başka tur yazmış) ATLANIR', () => {
    expect(karar(ROCK, '<p>Başka bir metin.</p>')).toMatchObject({ durum: 'atlandi' });
    expect(karar(THRASH, THRASH.oncekiHtml.replace('6 cm', '7 cm'))).toMatchObject({ durum: 'atlandi' });
  });
  it('NEGATİF (mutasyon): yeni metne yanlış ad sızarsa ATLANIR', () => {
    const es = ROCK.eslem.map((e, i) => (i === 0 ? { ...e, metin: e.metin.replace('Gooey Rock Jaw', 'Gooey Rock Jaw ve Blazagon') } : e));
    expect(karar({ ...ROCK, eslem: es, yeniHtml: eslemdenHtml(es) }, ROCK.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('yanlış ad') });
  });
  it('NEGATİF (mutasyon): yeni HTML eşlemede olmayan bir cümle taşırsa (kaynaksız) ATLANIR', () => {
    expect(karar({ ...ROCK, yeniHtml: ROCK.yeniHtml + '<p>Çok dayanıklıdır.</p>' }, ROCK.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('metin kapısı') });
  });
  it('NEGATİF: öncesinde yanlış ad yoksa (çelişki ölçülmedi) ya da yanlış ad başlıkta geçiyorsa ATLANIR', () => {
    expect(karar({ ...ROCK, yanlisAdlar: ['Shredz'] }, ROCK.oncekiHtml)).toMatchObject({ durum: 'atlandi' });
    expect(karar({ ...ROCK, baslik: ROCK.baslik + ' Blazagon' }, ROCK.oncekiHtml)).toMatchObject({ durum: 'atlandi' });
    expect(karar({ ...ROCK, dogruAdlar: ['Terrack'] }, ROCK.oncekiHtml)).toMatchObject({ durum: 'atlandi' });
  });
  it('NEGATİF: yeni metin yasak sözcük (kargo/iade/SEO…) taşırsa ATLANIR', () => {
    const es = [...ROCK.eslem, { bolum: 'gövde' as const, metin: 'Aynı gün kargo.', kaynaklar: ROCK.eslem[0]!.kaynaklar }];
    expect(karar({ ...ROCK, eslem: es, yeniHtml: eslemdenHtml(es) }, ROCK.oncekiHtml)).toMatchObject({ durum: 'atlandi' });
  });
});

describe('kalite kapısı yedeği: yalnız yanlış cümleler çıkar, uydurma eklenmez', () => {
  it('kalite geçmezse yeni metin YAZILMAZ; Thrash öncesinden yalnız yanlış adlı cümle çıkar, kalan cümleler aynen', () => {
    const ince = { ...THRASH, eslem: THRASH.eslem.slice(0, 5) };
    const k = kesin(karar(ince, THRASH.oncekiHtml));
    expect(k.kip).toBe('cikar');
    const d = duzMetin(k.html);
    for (const a of THRASH.yanlisAdlar) expect(adGecer(d, a)).toBe(false);
    expect(d).toContain('Goo gücünün en sevilen kahramanları');
    expect(d).toContain('Figür boyutu: 6 cm');
    for (const p of d.split(' ')) expect(duzMetin(THRASH.oncekiHtml).split(' ')).toContain(p);
  });
  it('Rock Jaw: « - Blazagon» kesilir, doğru gövde kalır; yalnız yanlış parça olan blok ⇒ geriye metin kalmaz ⇒ ATLANIR', () => {
    expect(kesin(karar({ ...ROCK, eslem: ROCK.eslem.slice(0, 5) }, ROCK.oncekiHtml)).html).toBe('<p>Goo Jit Zu Stretch Strikers Esnek Uzayan Yumuşak Tekli Figür Paket</p>');
    const tek = { ...ROCK, eslem: ROCK.eslem.slice(0, 5), oncekiHtml: '<p>Blazagon figürü.</p>' };
    expect(karar(tek, tek.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('metin kalmıyor') });
  });
  it('yanlisCumleleriCikar yeni sözcük eklemez', () => {
    expect(yanlisCumleleriCikar('<p>A doğru. B Blazagon. C doğru.</p><h2>X</h2>', ['Blazagon'])).toBe('<p>A doğru. C doğru.</p><h2>X</h2>');
  });
});

describe('çalıştırıcı', () => {
  const kur = (canli: Record<string, string>, degisir = false) => {
    const yazilan: Array<[string, string]> = []; const kutuk: KutukSatiri[] = [];
    const dep = {
      bul: async (h: string) => (h in canli ? { id: `gid://${h}`, handle: h, html: canli[h]! } : null),
      oku: async (id: string) => (degisir ? 'değişti' : canli[id.slice(6)]!),
      yaz: async (id: string, html: string) => { yazilan.push([id, html]); return { ok: true as const }; },
      kutuk: (s: KutukSatiri) => kutuk.push(s),
    };
    return { dep, yazilan, kutuk };
  };
  const canli = () => ({ [ROCK.handle]: ROCK.oncekiHtml, [THRASH.handle]: THRASH.oncekiHtml, 'goojitzu-stretch-strikers-tekli-paket-blazagon': '<p>Blazagon</p>' });

  it('DRY-RUN varsayılanında yaz HİÇ çağrılmaz; kütükte ÖNCESİ HTML var', async () => {
    const { dep, yazilan, kutuk } = kur(canli());
    const oz = await degistirCalistir(G, dep, { uygula: false });
    expect(yazilan).toHaveLength(0);
    expect(oz).toMatchObject({ yazilacak: 2, yazildi: 0 });
    for (const s of kutuk) expect(s.onceHtml).toBeTruthy();
  });
  it('uygula: yalnız listedeki 2 ürüne yazılır (başka ürüne dokunmaz); kütükte ÖNCESİ HTML birebir; ikinci koşu değişiklik-yok', async () => {
    const c = canli();
    const { dep, yazilan, kutuk } = kur(c);
    const oz = await degistirCalistir(G, dep, { uygula: true });
    expect(oz).toMatchObject({ yazildi: 2, hata: 0 });
    expect(yazilan.map(([id]) => id.slice(6)).sort()).toEqual([ROCK.handle, THRASH.handle].sort());
    for (const s of kutuk) expect(s.onceHtml).toBe(G.find((g) => g.handle === s.handle)!.oncekiHtml);
    for (const [id, h] of yazilan) c[id.slice(6)] = h.replace(/<\/li>/g, '</li>\n');
    const ikinci = kur(c);
    expect(await degistirCalistir(G, ikinci.dep, { uygula: true })).toMatchObject({ yazildi: 0, degisiklikYok: 2 });
    expect(ikinci.yazilan).toHaveLength(0);
  });
  it('okuma ile yazma arasında açıklama değiştiyse yazılmaz', async () => {
    const { dep, yazilan } = kur(canli(), true);
    expect(await degistirCalistir(G, dep, { uygula: true })).toMatchObject({ atlandi: 2, yazildi: 0 });
    expect(yazilan).toHaveLength(0);
  });
});

describe('aciklama-ekle · satır sonu normalleştirmesi (canlı Admin API örnekleri)', () => {
  const pilot = satir<EkleGiris>('994831-aciklama-pilot.jsonl');
  const d2 = satir<EkleGiris>('994831-aciklama-dalga2.jsonl');
  const canliOrnek = satir<{ handle: string; canliHtml: string }>('994831-canli-satir-sonu.jsonl');
  it('Shopify satır sonu eklemiş canlı metin → «zaten yazılı», ATLA değil', () => {
    for (const c of canliOrnek) {
      const g = [...pilot, ...d2].find((x) => x.handle === c.handle)!;
      expect(c.canliHtml).not.toBe(g.hedefHtml ?? g.taslakHtml);
      expect(ekleKarar(g, c.canliHtml, { kalite: !!g.mevcutHtml })).toMatchObject({ durum: 'degisiklik-yok', sebep: expect.stringContaining('satır sonu') });
    }
  });
  it('NEGATİF: satır sonu dışında bir bayt bile farklıysa hâlâ ATLANIR', () => {
    const c = canliOrnek[0]!; const g = pilot.find((x) => x.handle === c.handle)!;
    expect(ekleKarar(g, c.canliHtml.replace('1:64', '1:43'))).toMatchObject({ durum: 'atlandi' });
  });
});
