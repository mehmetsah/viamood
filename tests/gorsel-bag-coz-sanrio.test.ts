/**
 * #995712 · HELLO KITTY İKİ GÖRSELİNİN ÜRÜN BAĞI · ÇİVİ (#995648 yolunun yeniden kullanımı, md.24).
 * Girdi: veri/995712-gorsel-bag-coz.jsonl (galeri sırası = Admin dökümü 1 Kas 11:15Z, birebir).
 * #995648'den fark: hedef galerinin ORTASINDA (2/3). Geri almada bağ SONA kurulur → `sirala` adımı eski konuma taşır.
 * MUTASYON: veri bozulunca · hedef ana görsel olunca · sıra değişince · sıra düzeltme sökülünce KIRILIR.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bagCozCalistir, geriAlCalistir, karar, type Canli, type Giris, type KutukSatiri } from '../src/lib/gorsel-bag-coz';

const KOK = path.join(__dirname, '..');
const satir = (f: string) => readFileSync(path.join(KOK, 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Giris);
const G = satir('995712-gorsel-bag-coz.jsonl');
const DISNEY = satir('995648-gorsel-bag-coz.jsonl');
const H1 = 'hello-kitty-pembe-elbiseli-pelus-oyuncak-30-cm-resmi-sanrio-lisansli';
const H2 = 'hello-kitty-pembe-elbiseli-pelus-oyuncak-30-cm-resmi-sanrio-lisansli-kopya';
const url = (g: Giris, id: string) => `https://cdn.shopify.com/s/files/1/x/files/${id === g.mediaId ? g.dosyaAdi : id.split('/').pop() + '.jpg'}?v=1`;
const canli = (g: Giris, galeri = g.galeriOnce): Canli => ({ urunId: g.urunId, handle: g.handle, anaGorsel: g.anaGorselOnce, galeri: galeri.map((id) => ({ id, url: url(g, id) })) });

describe('veri', () => {
  it('tam 2 ürün (Hello Kitty + kopyası); hedef 3 görselin 2.si (ORTA), ana görsel 1., hedef ana görsel DEĞİL; dosyalar 511-2/526-2', () => {
    expect(G.map((g) => g.handle)).toEqual([H1, H2]);
    expect(G.map((g) => g.dosyaAdi)).toEqual(['511-2.png', '526-2.png']);
    for (const g of G) {
      expect(g.galeriOnce).toHaveLength(3);
      expect(g.galeriOnce.indexOf(g.mediaId)).toBe(1);
      expect(g.anaGorselOnce).toBe(g.galeriOnce[0]);
      expect(g.anaGorselOnce).not.toBe(g.mediaId);
      expect(g.gerekce).toMatch(/SANRIO CO\., LTD\. Used Under License/);
      expect(g.gerekce).toMatch(/Files.ta KALIR \(silinmez\)/);
    }
  });
  it('#995648 verisinden ayrı: medya ve ürün kesişimi 0 (Disney kancası damgalı, bu ayrı kanca)', () => {
    const d = new Set(DISNEY.flatMap((g) => [g.mediaId, g.urunId]));
    expect(G.flatMap((g) => [g.mediaId, g.urunId]).filter((x) => d.has(x))).toEqual([]);
  });
});

describe('karar', () => {
  it('yazılacak: sonrası [ana, 3.] — kalanların sırası aynı', () => {
    for (const g of G) expect(karar(g, canli(g))).toEqual({ durum: 'yazilacak', beklenenSonra: [g.galeriOnce[0], g.galeriOnce[2]] });
  });
  it('hedef ANA görsel olursa YAZMAZ; sıra değiştiyse YAZMAZ', () => {
    const g = G[0]!;
    expect(karar({ ...g, anaGorselOnce: g.mediaId }, { ...canli(g), anaGorsel: g.mediaId })).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('ANA görsel') });
    expect(karar(g, canli(g, [g.galeriOnce[1]!, g.galeriOnce[0]!, g.galeriOnce[2]!]))).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('sırası') });
  });
});

describe('çalıştırıcı + geri alma (orta konum)', () => {
  const magaza = () => {
    const db = new Map(G.map((g) => [g.handle, canli(g)]));
    const dosyalar = new Set(G.map((g) => g.mediaId)), cozulen: string[] = [], siralanan: string[] = [], kutuk: KutukSatiri[] = [];
    const urun = (id: string) => [...db.values()].find((c) => c.urunId === id)!;
    return {
      db, dosyalar, cozulen, siralanan, kutuk,
      dep: {
        oku: async (h: string) => { const c = db.get(h); return c ? { ...c, galeri: c.galeri.map((m) => ({ ...m })) } : null; },
        dosya: async (id: string) => (dosyalar.has(id) ? { fileStatus: 'READY', url: 'https://cdn/' + id } : null),
        bagCoz: async (m: string, u: string) => { cozulen.push(m); const c = urun(u); c.galeri = c.galeri.filter((x) => x.id !== m); return { ok: true as const }; },
        // Shopify davranışı: yeniden bağlanan medya galerinin SONUNA eklenir.
        bagKur: async (m: string, u: string) => { const g = G.find((x) => x.mediaId === m)!; urun(u).galeri.push({ id: m, url: url(g, m) }); return { ok: true as const }; },
        sirala: async (u: string, m: string, k: number) => { siralanan.push(m); const c = urun(u); const x = c.galeri.find((y) => y.id === m)!; c.galeri = c.galeri.filter((y) => y.id !== m); c.galeri.splice(k, 0, x); return { ok: true as const }; },
        kutuk: (s: KutukSatiri) => { kutuk.push(s); },
      },
    };
  };
  it('uygula: 2 bağ çözülür, dosyalar Files\'ta, kalan [ana, 3.]; ÖNCESİ önce kütükte', async () => {
    const m = magaza();
    expect(await bagCozCalistir(G, m.dep, { uygula: true })).toMatchObject({ yazildi: 2, hata: 0, durdu: false });
    for (const g of G) {
      expect(m.dosyalar.has(g.mediaId)).toBe(true);
      expect(m.db.get(g.handle)!.galeri.map((x) => x.id)).toEqual([g.galeriOnce[0], g.galeriOnce[2]]);
      expect(m.kutuk.filter((k) => k.handle === g.handle).map((k) => k.durum)).toEqual(['oncesi-kaydedildi', 'yazildi']);
    }
  });
  it('GERİ ALMA: sona kurulan medya sirala ile 2. konuma taşınır → galeri ÖNCESİ ile birebir', async () => {
    const m = magaza();
    await bagCozCalistir(G, m.dep, { uygula: true });
    expect(await geriAlCalistir(G, m.dep)).toEqual({ geriAlindi: 2, hata: 0 });
    expect(m.siralanan.sort()).toEqual(G.map((g) => g.mediaId).sort());
    for (const g of G) expect(m.db.get(g.handle)!.galeri.map((x) => x.id)).toEqual(g.galeriOnce);
  });
  it('sıra düzeltme adımı yoksa geri alma «geri alındı» DEMEZ (sıra öncesinden farklı)', async () => {
    const m = magaza();
    await bagCozCalistir(G, m.dep, { uygula: true });
    const { sirala: _yok, ...dep } = m.dep;
    expect(await geriAlCalistir(G, dep)).toEqual({ geriAlindi: 0, hata: 2 });
  });
  it('#995648 (hedef SON konumda): sirala verilse bile ÇAĞRILMAZ — gereksiz sıra işlemi yok', async () => {
    const db = new Map(DISNEY.map((g) => [g.handle, { urunId: g.urunId, handle: g.handle, anaGorsel: g.anaGorselOnce, galeri: g.galeriOnce.filter((x) => x !== g.mediaId).map((id) => ({ id, url: 'u' })) }]));
    const siralanan: string[] = [];
    const oz = await geriAlCalistir(DISNEY, {
      oku: async (h) => { const c = db.get(h)!; return { ...c, galeri: c.galeri.map((x) => ({ ...x })) }; },
      kutuk: () => {},
      bagKur: async (m, u) => { [...db.values()].find((c) => c.urunId === u)!.galeri.push({ id: m, url: 'u' }); return { ok: true as const }; },
      sirala: async (_u, m) => { siralanan.push(m); return { ok: true as const }; },
    });
    expect(oz).toEqual({ geriAlindi: 2, hata: 0 });
    expect(siralanan).toEqual([]);
  });
});

describe('betik', () => {
  const b = readFileSync(path.join(KOK, 'scripts', 'gorsel-bag-coz.mts'), 'utf8');
  it('productReorderMedia YALNIZ --geri-al dalında; bağ çözme yolu fileUpdate(referencesToRemove)', () => {
    const geri = b.indexOf('if (geriAl) {'), ilk = b.indexOf('productReorderMedia(');
    expect(geri).toBeGreaterThan(0);
    expect(ilk).toBeGreaterThan(geri);
    expect(b.indexOf('productReorderMedia(', ilk + 1)).toBe(-1);
    expect(ilk).toBeLessThan(b.indexOf('const ozet = await bagCozCalistir('));
  });
  it('kanca: ayrı damga, ayrı veri, aynı betik', () => {
    const k = readFileSync(path.join(KOK, 'scripts', 'gorsel-bag-coz-sanrio-kur.sh'), 'utf8');
    expect(k).toContain('/var/www/viamood-extras/995712-gorsel-bag-coz.damga');
    expect(k).toContain('scripts/gorsel-bag-coz.mts veri/995712-gorsel-bag-coz.jsonl --uygula');
    expect(k.split('\n').filter((l) => !l.startsWith('#')).join('\n')).not.toContain('995648'); // yorum satırı kardeş vakayı anar
  });
});
