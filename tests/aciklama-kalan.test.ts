/**
 * #994831 · KALAN İÇERİK HATALARI · ÇİVİ (Mehmet kararı 31 Eki 2026: üçü de düzeltilsin).
 * Girdiler: veri/994831-aciklama-kalan.jsonl (oncekiHtml = canlı açıklamanın birebir kopyası, Admin API 31 Eki 2026 20:45Z).
 *  · Wreckin Rock Jaw (tek paket) — açıklama «Thrash, Rock Jaw, Blazagon ve Pantaro olmak üzere 4 asortiden» diyordu:
 *    yanlış metin kalkar, ambalaj + başlık eşlemesinin birebir çıktısı yazılır (aciklama-degistir «degistir» kipi).
 *  · goo-mobiles-gjt46000 · blazagon-vs-shredz — açıklama «… Ürünün» diye yarım bitiyordu: yalnız « Ürünün» düşer,
 *    yerine bir şey yazılmaz (aciklama-degistir «yarim» kipi).
 * MUTASYON: asorti dili/yanlış ad sızması, kaynaksız cümle, öncesi kapısı, yarım parça kapıları, «başka bayt değişmez»,
 * dry-run, yeniden okuma kaldırılırsa ilgili iddialar KIRILIR.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { adGecer, degistirCalistir, eslemdenHtml, karar, yarimCumleCikar, yarimKarar, yarimMi, type Giris, type KutukSatiri, type YarimGiris } from '../src/lib/aciklama-degistir';
import { kaliteKapisi } from '../src/lib/aciklama-ekle';
import { duzMetin } from '../src/lib/aciklama-ic-not';

const G = readFileSync(path.join(__dirname, '..', 'veri', '994831-aciklama-kalan.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Giris | YarimGiris);
const ROCK = G.find((g) => g.handle === 'goojitzu-goo-mobiles-stretch-araclar-gjt46000-wreckin-rock-jaw') as Giris;
const YARIM = G.filter(yarimMi);
const MOBIL = YARIM.find((g) => g.handle === 'goojitzu-goo-mobiles-stretch-araclar-gjt46000')!;
const SHREDZ = YARIM.find((g) => g.handle.endsWith('-blazagon-vs-shredz'))!;
const ASORTI = ['Thrash', 'Blazagon', 'Pantaro', 'asorti', '4 asortiden'];
const kesin = (k: ReturnType<typeof karar>) => { if (k.durum !== 'yazilacak') throw new Error(`${k.durum}: ${'sebep' in k ? k.sebep : ''}`); return k; };

describe('veri ve kaynak şartı', () => {
  it('tam 3 ürün: Wreckin Rock Jaw (asorti dili) + 2 yarım cümle; başka ürün yok', () => {
    expect(G.map((g) => g.handle).sort()).toEqual([ROCK.handle, MOBIL.handle, SHREDZ.handle].sort());
    expect(YARIM).toHaveLength(2);
    expect(ROCK.oncekiHtml).toContain('Thrash, Rock Jaw, Blazagon ve Pantaro olmak üzere 4 asortiden');
    expect(ROCK.baslik).toContain('Wreckin Rock Jaw');
    for (const g of YARIM) { expect(g.yarimParca).toBe('Ürünün'); expect(g.oncekiHtml).toMatch(/geçirebilirler\. Ürünün<\/p>\n$/); }
  });
  it('Rock Jaw yeni HTML = eşlemenin birebir çıktısı; her satır ≥1 kaynak; tür yalnız başlık / ürünün kendi ambalaj görseli', () => {
    expect(ROCK.yeniHtml).toBe(eslemdenHtml(ROCK.eslem));
    for (const e of ROCK.eslem) {
      expect(e.kaynaklar.length, e.metin).toBeGreaterThan(0);
      for (const k of e.kaynaklar) {
        expect(['baslik', 'ambalaj']).toContain(k.tur);
        if (k.tur === 'ambalaj') expect(k.kaynak).toBe('https://cdn.shopify.com/s/files/1/1006/6021/5940/files/313-1.jpg');
        if (k.tur === 'baslik') for (const p of k.alinti.split(' · ')) expect(adGecer(ROCK.baslik, p), p).toBe(true);
      }
    }
    expect(kaliteKapisi(ROCK)).toMatchObject({ gecti: true, satir: 16 });
    expect(ROCK.bosBirakilan!.length).toBeGreaterThan(0);
  });
});

describe('Wreckin Rock Jaw · asorti dili', () => {
  it('canlı = öncesi iken yazılacak = yeniHtml (kip değiştir); yeni metinde asorti dili / başka karakter YOK, Rock Jaw VAR', () => {
    const k = kesin(karar(ROCK, ROCK.oncekiHtml));
    expect(k.kip).toBe('degistir');
    expect(k.html).toBe(ROCK.yeniHtml);
    const d = duzMetin(k.html);
    for (const a of ASORTI) expect(adGecer(d, a), a).toBe(false);
    expect(d).toContain("Wreckin' Rock Jaw");
    expect(d).toContain('Paket içerisinde 1 adet');
  });
  it('idempotans: canlı zaten yeni metinse (Shopify satır sonu ekleşe de) değişiklik-yok', () => {
    expect(karar(ROCK, ROCK.yeniHtml.replace(/<\/p>/g, '</p>\r\n'))).toMatchObject({ durum: 'degisiklik-yok' });
  });
  it('NEGATİF (mutasyon): yeni metne asorti dili sızarsa ATLANIR', () => {
    const eslem = ROCK.eslem.map((e, i) => (i === 0 ? { ...e, metin: `${e.metin} Thrash, Blazagon ve Pantaro olmak üzere 4 asortiden oluşur.` } : e));
    expect(karar({ ...ROCK, eslem, yeniHtml: eslemdenHtml(eslem) }, ROCK.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('yanlış ad') });
  });
  it('NEGATİF (mutasyon): yeni HTML eşlemede olmayan cümle taşırsa (kaynaksız) ATLANIR', () => {
    expect(karar({ ...ROCK, yeniHtml: ROCK.yeniHtml + '<p>Tekerlekleri döner.</p>' }, ROCK.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('metin kapısı') });
  });
  it('NEGATİF: canlı öncesinden farklıysa ATLANIR', () => {
    expect(karar(ROCK, ROCK.oncekiHtml + '<p>x</p>')).toMatchObject({ durum: 'atlandi' });
  });
});

describe('yarım cümle · yalnız « Ürünün» düşer', () => {
  it('iki üründe yazılacak HTML = öncesinden YALNIZ « Ürünün» silinmiş hâl; metin cümle sonuyla biter; yeni sözcük yok', () => {
    for (const g of YARIM) {
      const k = kesin(yarimKarar(g, g.oncekiHtml));
      expect(k.kip).toBe('yarim');
      expect(k.html).toBe(g.oncekiHtml.replace(/ Ürünün<\/p>\n$/, '</p>\n'));
      expect(Buffer.byteLength(g.oncekiHtml) - Buffer.byteLength(k.html)).toBe(Buffer.byteLength(' Ürünün'));
      const d = duzMetin(k.html);
      expect(d).toMatch(/keyifli zaman geçirebilirler\.$/);
      expect(d).not.toContain('Ürünün');
      expect(duzMetin(g.oncekiHtml).startsWith(d)).toBe(true);
    }
  });
  it('idempotans: canlı zaten hedefse (Shopify satır sonu ekleşe de) değişiklik-yok', () => {
    for (const g of YARIM) expect(yarimKarar(g, yarimCumleCikar(g.oncekiHtml, 'Ürünün')!.replace(/\n/g, '\r\n'))).toMatchObject({ durum: 'degisiklik-yok' });
  });
  it('NEGATİF: canlı öncesinden farklıysa ATLANIR', () => {
    expect(yarimKarar(MOBIL, MOBIL.oncekiHtml.replace('Ürünün', 'Ürünün özellikleri.'))).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('öncesinden farklı') });
  });
  it('NEGATİF: parça tam cümleyse (cümle sonu işaretiyle bitiyorsa) yarım sayılmaz → ATLANIR', () => {
    const o = MOBIL.oncekiHtml.replace(' Ürünün</p>', ' Ürünün özellikleri bunlar.</p>');
    expect(yarimKarar({ ...MOBIL, oncekiHtml: o, yarimParca: 'bunlar.' }, o)).toMatchObject({ durum: 'atlandi' });
    expect(yarimKarar({ ...MOBIL, oncekiHtml: o }, o)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('bitmiyor') });
  });
  it('NEGATİF: parçadan önce cümle sonu yoksa (tam cümlenin parçası kesilir) ATLANIR', () => {
    const o = MOBIL.oncekiHtml.replace('geçirebilirler. Ürünün', 'geçirebilirler Ürünün');
    expect(yarimKarar({ ...MOBIL, oncekiHtml: o }, o)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('cümle sonu yok') });
  });
  it('NEGATİF: parça 3 sözcükten uzunsa (gerçek içerik silinebilir) ATLANIR', () => {
    const o = MOBIL.oncekiHtml.replace('geçirebilirler. Ürünün', 'geçirebilirler. Ürünün bütün parçaları dayanıklı');
    expect(yarimKarar({ ...MOBIL, oncekiHtml: o, yarimParca: 'Ürünün bütün parçaları dayanıklı' }, o)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('geçersiz') });
  });
  it('boş blok / başlık sonrası da son METİNLİ bloğu bulur; parça başka bloğun sonundaysa null (ortadaki metne dokunulmaz)', () => {
    const o = MOBIL.oncekiHtml.replace('</p>\n', '</p>\n<p> </p><h3>Not</h3>');
    expect(yarimCumleCikar(o, 'Ürünün')).toBe(o.replace(' Ürünün</p>', '</p>'));
    const o2 = '<p>Birinci. Ürünün</p><p>İkinci tam cümle.</p>';
    expect(yarimCumleCikar(o2, 'Ürünün')).toBeNull();
  });
});

describe('çalıştırıcı (karışık liste)', () => {
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
  const BASKA = 'goojitzu-goo-mobiles-stretch-araclar-gjt46000-powerhouse-pantaro';
  const canli = (): Record<string, string> => ({ ...Object.fromEntries(G.map((g) => [g.handle, g.oncekiHtml])), [BASKA]: '<p>Ürünün</p>' });

  it('DRY-RUN varsayılanında yaz HİÇ çağrılmaz; 3 yazılacak; kütükte ÖNCESİ HTML ve kip var', async () => {
    const { dep, yazilan, kutuk } = kur(canli());
    expect(await degistirCalistir(G, dep, { uygula: false })).toMatchObject({ yazilacak: 3, yazildi: 0 });
    expect(yazilan).toHaveLength(0);
    expect(kutuk.map((s) => s.kip).sort()).toEqual(['degistir', 'yarim', 'yarim']);
    for (const s of kutuk) expect(s.onceHtml).toBe(G.find((g) => g.handle === s.handle)!.oncekiHtml);
  });
  it('uygula: yalnız listedeki 3 ürüne yazılır (başka ürüne dokunmaz); ikinci koşu değişiklik-yok', async () => {
    const c = canli();
    const { dep, yazilan } = kur(c);
    expect(await degistirCalistir(G, dep, { uygula: true })).toMatchObject({ yazildi: 3, hata: 0, atlandi: 0 });
    expect(yazilan.map(([id]) => id.slice(6)).sort()).toEqual(G.map((g) => g.handle).sort());
    expect(yazilan.some(([id]) => id.endsWith(BASKA))).toBe(false);
    for (const [id, h] of yazilan) c[id.slice(6)] = h.replace(/<\/p>/g, '</p>\n');
    const ikinci = kur(c);
    expect(await degistirCalistir(G, ikinci.dep, { uygula: true })).toMatchObject({ yazildi: 0, degisiklikYok: 3 });
    expect(ikinci.yazilan).toHaveLength(0);
  });
  it('okuma ile yazma arasında açıklama değiştiyse yazılmaz', async () => {
    const { dep, yazilan } = kur(canli(), true);
    expect(await degistirCalistir(G, dep, { uygula: true })).toMatchObject({ atlandi: 3, yazildi: 0 });
    expect(yazilan).toHaveLength(0);
  });
});
