/**
 * #995648 · İKİ «© Disney YETKİLİ SATICI» GÖRSELİNİN ÜRÜN BAĞI · ÇİVİ.
 * Girdi: veri/995648-gorsel-bag-coz.jsonl (galeri sırası = Admin dökümü 1 Kas 10:27Z, birebir).
 * Ölçülenler: yalnız hedef medya galeriden çıkar, kalanların sırası ve ana görsel aynı · dosya SİLİNMEZ (silinirse iş DURUR)
 * · ÖNCESİ kütüğe yazılmadan bağ çözülmez · dry-run yazmaz · geri alma galeriyi birebir geri getirir · betikte silen mutasyon yok.
 * MUTASYON: kapılardan biri, ÖNCESİ-önce kütük sırası, dosya-varlık freni ya da geri alma ölçümü sökülürse KIRILIR.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bagCozCalistir, geriAlCalistir, karar, type Canli, type Giris, type KutukSatiri } from '../src/lib/gorsel-bag-coz';

const KOK = path.join(__dirname, '..');
const G = readFileSync(path.join(KOK, 'veri', '995648-gorsel-bag-coz.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Giris);
const HULA = 'jada-disney-hula-stitch-die-cast-metal-figur-5-cm-lisansli-koleksiyon-figuru-hula-dans-yapan-stitch';
const UKU = 'jada-disney-ukulele-stitch-die-cast-metal-figur-5-cm-lisansli-koleksiyon-figuru-ukulele-calan-stitch';
const url = (g: Giris, id: string) => `https://cdn.shopify.com/s/files/1/x/files/${id === g.mediaId ? g.dosyaAdi : id.split('/').pop() + '.jpg'}?v=1`;
const canli = (g: Giris, galeri = g.galeriOnce): Canli => ({ urunId: g.urunId, handle: g.handle, anaGorsel: g.anaGorselOnce, galeri: galeri.map((id) => ({ id, url: url(g, id) })) });
const kesin = (k: ReturnType<typeof karar>) => { if (k.durum !== 'yazilacak') throw new Error(`${k.durum}: ${'sebep' in k ? k.sebep : ''}`); return k; };

describe('veri', () => {
  it('tam 2 ürün (Hula + Ukulele); hedef galerinin SON görseli, ana görsel değil; Gemini dosyası; gerekçe «silinmez»', () => {
    expect(G.map((g) => g.handle).sort()).toEqual([HULA, UKU].sort());
    for (const g of G) {
      expect(g.galeriOnce).toHaveLength(10);
      expect(g.galeriOnce.filter((x) => x === g.mediaId)).toHaveLength(1);
      expect(g.galeriOnce.at(-1)).toBe(g.mediaId);
      expect(g.anaGorselOnce).toBe(g.galeriOnce[0]);
      expect(g.anaGorselOnce).not.toBe(g.mediaId);
      expect(g.dosyaAdi).toMatch(/^Gemini_Generated_Image_snujv0snujv0snuj.*\.png$/);
      expect(g.gerekce).toMatch(/Files.ta KALIR \(silinmez\)/);
    }
    expect(new Set(G.map((g) => g.mediaId)).size).toBe(2);
  });
});

describe('karar', () => {
  it('yazılacak: sonrası = öncesi eksi hedef, kalan 9 görselin sırası aynı', () => {
    for (const g of G) {
      const r = kesin(karar(g, canli(g)));
      expect(r.beklenenSonra).toEqual(g.galeriOnce.slice(0, 9));
    }
  });
  it('idempotans: bağ zaten çözülmüşse değişiklik-yok', () => {
    for (const g of G) expect(karar(g, canli(g, g.galeriOnce.slice(0, 9)))).toMatchObject({ durum: 'degisiklik-yok' });
  });
  const g = G[0]!;
  it('galeri sırası değiştiyse YAZMAZ', () => {
    const ters = [...g.galeriOnce]; [ters[1], ters[2]] = [ters[2]!, ters[1]!];
    expect(karar(g, canli(g, ters))).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('sırası') });
  });
  it('ürün kimliği farklıysa YAZMAZ', () => {
    expect(karar(g, { ...canli(g), urunId: 'gid://shopify/Product/1' })).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('kimliği') });
  });
  it('dosya adı beklenenle aynı değilse YAZMAZ', () => {
    const c = canli(g); c.galeri = c.galeri.map((m) => (m.id === g.mediaId ? { ...m, url: 'https://cdn/x/files/506-1.jpg?v=1' } : m));
    expect(karar(g, c)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('dosya adı') });
  });
  it('hedef ANA görselse ya da ana görsel değiştiyse YAZMAZ', () => {
    expect(karar({ ...g, anaGorselOnce: g.mediaId }, { ...canli(g), anaGorsel: g.mediaId })).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('ANA görsel') });
    expect(karar(g, { ...canli(g), anaGorsel: g.galeriOnce[3]! })).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('ana görsel') });
  });
  it('hedef iki kez geçiyorsa ya da sonrasında görsel kalmıyorsa YAZMAZ', () => {
    const iki = [...g.galeriOnce, g.mediaId];
    expect(karar({ ...g, galeriOnce: iki }, canli(g, iki))).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('2 kez') });
    const tek = { ...g, galeriOnce: [g.mediaId], anaGorselOnce: 'x' };
    expect(karar(tek, { ...canli(tek), anaGorsel: 'x' })).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('görsel kalmıyor') });
  });
  it('gerekçe boşsa YAZMAZ', () => {
    expect(karar({ ...g, gerekce: ' ' }, canli(g))).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('gerekçe') });
  });
});

describe('çalıştırıcı — dosya silinmez, ÖNCESİ önce, sorun olursa DUR', () => {
  const magaza = (o: { kutukAtar?: boolean; okuFark?: boolean; dosyaSilinir?: boolean; sirayiBozar?: boolean; basaKurar?: boolean } = {}) => {
    const db = new Map(G.map((g) => [g.handle, canli(g)]));
    db.set('baska-urun', { urunId: 'gid://shopify/Product/9', handle: 'baska-urun', anaGorsel: 'm1', galeri: [{ id: 'm1', url: 'u1' }, { id: 'm2', url: 'u2' }] });
    const dosyalar = new Set(G.map((g) => g.mediaId)), cozulen: string[] = [], kutuk: KutukSatiri[] = []; let okuma = 0;
    const kopya = (c: Canli) => ({ ...c, galeri: c.galeri.map((m) => ({ ...m })) });
    return {
      db, dosyalar, cozulen, kutuk,
      dep: {
        oku: async (h: string) => { okuma++; const c = db.get(h); if (!c) return null; const k = kopya(c); return o.okuFark && okuma % 2 === 0 ? { ...k, anaGorsel: 'baska' } : k; },
        dosya: async (id: string) => (dosyalar.has(id) ? { fileStatus: 'READY', url: 'https://cdn/' + id } : null),
        bagCoz: async (mediaId: string, urunId: string) => {
          cozulen.push(mediaId);
          for (const c of db.values()) if (c.urunId === urunId) { c.galeri = c.galeri.filter((m) => m.id !== mediaId); if (o.sirayiBozar) c.galeri.reverse(); }
          if (o.dosyaSilinir) dosyalar.delete(mediaId);
          return { ok: true as const };
        },
        bagKur: async (mediaId: string, urunId: string) => {
          for (const c of db.values()) if (c.urunId === urunId) { const g = G.find((x) => x.mediaId === mediaId)!; const m = { id: mediaId, url: url(g, mediaId) }; if (o.basaKurar) c.galeri.unshift(m); else c.galeri.push(m); }
          return { ok: true as const };
        },
        kutuk: (s: KutukSatiri) => { if (o.kutukAtar && s.durum === 'oncesi-kaydedildi') throw new Error('disk dolu'); kutuk.push(s); },
      },
    };
  };
  it('dry-run varsayılanında bagCoz HİÇ çağrılmaz', async () => {
    const m = magaza();
    expect(await bagCozCalistir(G, m.dep, { uygula: false })).toMatchObject({ yazilacak: 2, yazildi: 0 });
    expect(m.cozulen).toEqual([]);
  });
  it('uygula: yalnız 2 bağ çözülür; dosyalar Files\'ta kalır; kalan sıra + ana görsel aynı; başka ürüne dokunulmaz; ikinci koşu 0', async () => {
    const m = magaza();
    expect(await bagCozCalistir(G, m.dep, { uygula: true })).toMatchObject({ yazildi: 2, hata: 0, durdu: false });
    expect(m.cozulen.sort()).toEqual(G.map((g) => g.mediaId).sort());
    for (const g of G) {
      expect(m.dosyalar.has(g.mediaId)).toBe(true);
      expect(m.db.get(g.handle)!.galeri.map((x) => x.id)).toEqual(g.galeriOnce.slice(0, 9));
      const ks = m.kutuk.filter((k) => k.handle === g.handle);
      expect(ks.map((k) => k.durum)).toEqual(['oncesi-kaydedildi', 'yazildi']);
      expect(ks[0]!.galeriOnce).toEqual(g.galeriOnce);
      expect(ks[1]!.dosya).toMatchObject({ fileStatus: 'READY' });
    }
    expect(m.db.get('baska-urun')!.galeri).toHaveLength(2);
    m.cozulen.length = 0;
    expect(await bagCozCalistir(G, m.dep, { uygula: true })).toMatchObject({ degisiklikYok: 2, yazildi: 0 });
    expect(m.cozulen).toEqual([]);
  });
  it('ÖNCESİ kütüğü yazılamazsa bagCoz HİÇ koşmaz; okuma ile yazma arasında değiştiyse yazmaz', async () => {
    const a = magaza({ kutukAtar: true });
    expect(await bagCozCalistir(G, a.dep, { uygula: true })).toMatchObject({ yazildi: 0, hata: 2 });
    expect(a.cozulen).toEqual([]);
    const b = magaza({ okuFark: true });
    expect(await bagCozCalistir(G, b.dep, { uygula: true })).toMatchObject({ yazildi: 0, atlandi: 2 });
    expect(b.cozulen).toEqual([]);
  });
  it('KIRMIZI ÇİZGİ FRENİ: bağ çözülünce dosya Files\'tan kaybolursa iş DURUR, ikinci ürüne dokunulmaz', async () => {
    const m = magaza({ dosyaSilinir: true });
    const oz = await bagCozCalistir(G, m.dep, { uygula: true });
    expect(oz).toMatchObject({ durdu: true, hata: 1, yazildi: 0 });
    expect(m.cozulen).toHaveLength(1);
    expect(m.kutuk.at(-1)).toMatchObject({ durum: 'hata', sebep: expect.stringContaining('DURDU') });
  });
  it('sonrası beklenenden farklıysa (sıra bozuldu) iş DURUR', async () => {
    const m = magaza({ sirayiBozar: true });
    expect(await bagCozCalistir(G, m.dep, { uygula: true })).toMatchObject({ durdu: true, yazildi: 0 });
    expect(m.cozulen).toHaveLength(1);
  });
  it('GERİ ALMA: bağ yeniden kurulur ve galeri ÖNCESİ ile birebir aynı olur', async () => {
    const m = magaza();
    await bagCozCalistir(G, m.dep, { uygula: true });
    expect(await geriAlCalistir(G, m.dep)).toEqual({ geriAlindi: 2, hata: 0 });
    for (const g of G) expect(m.db.get(g.handle)!.galeri.map((x) => x.id)).toEqual(g.galeriOnce);
    expect(await geriAlCalistir(G, m.dep)).toEqual({ geriAlindi: 0, hata: 0 }); // zaten kurulu
  });
  it('GERİ ALMA ölçer: bağ yanlış sıraya kurulursa «geri alındı» DENMEZ, hata yazılır', async () => {
    const m = magaza({ basaKurar: true });
    await bagCozCalistir(G, m.dep, { uygula: true });
    expect(await geriAlCalistir(G, m.dep)).toEqual({ geriAlindi: 0, hata: 2 });
    expect(m.kutuk.filter((k) => k.durum === 'hata').map((k) => k.sebep)).toEqual(['geri alındı ama galeri sırası öncesinden farklı', 'geri alındı ama galeri sırası öncesinden farklı']);
  });
});

describe('betik — silen mutasyon YOK', () => {
  const b = readFileSync(path.join(KOK, 'scripts', 'gorsel-bag-coz.mts'), 'utf8');
  it('yalnız fileUpdate referencesToRemove / referencesToAdd; productDeleteMedia · fileDelete · productUpdate · productSet yok', () => {
    expect(b).toContain("referans('referencesToRemove')");
    expect(b).toContain("referans('referencesToAdd')");
    expect(b).toContain('fileUpdate(files:$f)');
    expect(b.replace(/\/\*\*[\s\S]*?\*\//, '')).not.toMatch(/productDeleteMedia|fileDelete|productUpdate|productSet|productVariant|publishableUnpublish/);
  });
});
