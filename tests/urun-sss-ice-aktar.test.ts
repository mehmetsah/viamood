/**
 * #994831 · ÜRÜN SSS TOPLU İÇE AKTARMA ÇİVİSİ.
 * Dry-run kapısı, idempotans, eksik alan reddi ve hatalı handle'da sürecin sürmesi.
 * MUTASYON: src/lib/urun-sss-ice-aktar.ts içindeki `if (!uygula)` dry-run kapısı kaldırılırsa
 * "dry-run'da 0 yazma" iddiaları KIRILIR.
 */
import { describe, expect, it } from 'vitest';
import { satirAyristir, sssIceAktar, SSS_URUN_BASI_EN_COK, type KutukSatiri } from '../src/lib/urun-sss-ice-aktar';

type Kayit = { soru: string; cevap: string };

/** Bellek içi DB + Shopify; her çağrı sayılır. */
function sahte(urunler: string[], mevcut: Record<string, Kayit[]> = {}, senkronHata?: string) {
  const db: Record<string, Kayit[]> = JSON.parse(JSON.stringify(mevcut));
  const say = { yaz: 0, senkron: 0 };
  const kutuk: KutukSatiri[] = [];
  return {
    db, say, kutuk,
    dep: {
      mevcutOku: async (h: string) => db[h] ?? [],
      urunVarMi: async (h: string) => urunler.includes(h),
      yaz: async (h: string, k: Array<Kayit & { sira: number }>) => { say.yaz++; db[h] = k.map(({ soru, cevap }) => ({ soru, cevap })); },
      senkronla: async () => { say.senkron++; return senkronHata ? { ok: false, hata: senkronHata } : { ok: true }; },
      kutuk: (s: KutukSatiri) => { kutuk.push(s); },
    },
  };
}
const satir = (handle: string, sss: Array<Partial<Kayit>>) => JSON.stringify({ handle, sss });
const IKI = [{ soru: 'Kapağı kilitli mi?', cevap: 'Evet, kilitli kapaklıdır.' }, { soru: 'Kaç adet?', cevap: '3 adet.' }];

describe('#994831 · SSS içe aktarma', () => {
  it('1) VARSAYILAN DRY-RUN: ayar verilmezse yaz/senkron HİÇ çağrılmaz, DB değişmez', async () => {
    const s = sahte(['kutu-a', 'kutu-b']);
    const o = await sssIceAktar([satir('kutu-a', IKI), satir('kutu-b', IKI)], s.dep);
    expect(s.say.yaz).toBe(0);
    expect(s.say.senkron).toBe(0);
    expect(s.db).toEqual({});
    expect(o['dry-run-yazilacak']).toBe(2);
    expect(s.kutuk.every((k) => k.kip === 'dry-run')).toBe(true);
  });

  it('2) dry-run açıkça `uygula:false` ile de yazmaz; yalnız `uygula:true` yazar', async () => {
    const s = sahte(['kutu-a']);
    await sssIceAktar([satir('kutu-a', IKI)], s.dep, { uygula: false });
    expect(s.say.yaz).toBe(0);
    const o = await sssIceAktar([satir('kutu-a', IKI)], s.dep, { uygula: true });
    expect(o.yazildi).toBe(1);
    expect(s.say.yaz).toBe(1);
    expect(s.say.senkron).toBe(1);
    expect(s.db['kutu-a']).toEqual(IKI);
  });

  it('3) İDEMPOTANS: aynı girdi ikinci koşuda tekrar yazılmaz ("zaten-yazili")', async () => {
    const s = sahte(['kutu-a']);
    await sssIceAktar([satir('kutu-a', IKI)], s.dep, { uygula: true });
    const o2 = await sssIceAktar([satir('kutu-a', IKI)], s.dep, { uygula: true });
    expect(s.say.yaz).toBe(1);
    expect(o2['zaten-yazili']).toBe(1);
    expect(o2.yazildi).toBe(0);
  });

  it('4) elle yazılmış FARKLI SSS ezilmez ("mevcut-sss-var")', async () => {
    const s = sahte(['kutu-a'], { 'kutu-a': [{ soru: 'Elle soru', cevap: 'Elle cevap' }] });
    const o = await sssIceAktar([satir('kutu-a', IKI)], s.dep, { uygula: true });
    expect(o['mevcut-sss-var']).toBe(1);
    expect(s.say.yaz).toBe(0);
    expect(s.db['kutu-a']).toEqual([{ soru: 'Elle soru', cevap: 'Elle cevap' }]);
  });

  it('5) EKSİK/BOŞ ALAN reddi: boş cevap · boş soru · boş liste · handle yok · bozuk JSON · HTML', () => {
    expect(satirAyristir(satir('kutu-a', [{ soru: 'S?', cevap: '' }]))).toMatchObject({ hata: expect.stringContaining('cevap boş') });
    expect(satirAyristir(satir('kutu-a', [{ soru: ' ', cevap: 'C' }]))).toMatchObject({ hata: expect.stringContaining('soru boş') });
    expect(satirAyristir(satir('kutu-a', []))).toMatchObject({ hata: expect.stringContaining('boş') });
    expect(satirAyristir(JSON.stringify({ sss: IKI }))).toMatchObject({ hata: expect.stringContaining('handle') });
    expect(satirAyristir('{bozuk')).toMatchObject({ hata: 'geçersiz JSON' });
    expect(satirAyristir(satir('kutu-a', [{ soru: 'S?', cevap: '<b>x</b>' }]))).toMatchObject({ hata: expect.stringContaining('HTML') });
  });

  it('6) ürün başı tavan + tekrar eden soru reddi', () => {
    const fazla = Array.from({ length: SSS_URUN_BASI_EN_COK + 1 }, (_, i) => ({ soru: `S${i}?`, cevap: 'C' }));
    expect(satirAyristir(satir('kutu-a', fazla))).toMatchObject({ hata: expect.stringContaining('en çok') });
    expect(satirAyristir(satir('kutu-a', [{ soru: 'Aynı?', cevap: '1' }, { soru: 'aynı?', cevap: '2' }]))).toMatchObject({ hata: expect.stringContaining('tekrar') });
  });

  it('7) HATALI HANDLE süreci DURDURMAZ: yok ürün + bozuk satır + geçerli satır → geçerli yazılır', async () => {
    const s = sahte(['kutu-iyi']);
    const o = await sssIceAktar(
      [satir('olmayan-urun', IKI), '{bozuk', satir('Kutu İyi!', IKI), satir('kutu-iyi', IKI)],
      s.dep, { uygula: true },
    );
    expect(o['urun-yok']).toBe(1);
    expect(o.reddedildi).toBe(2);
    expect(o.yazildi).toBe(1);
    expect(s.db['kutu-iyi']).toEqual(IKI);
    expect(s.db['olmayan-urun']).toBeUndefined();
  });

  it('8) KÜTÜK: her dolu satır bir kayıt (satır no · handle · sonuç · sebep · kip); boş satır sayılmaz', async () => {
    const s = sahte(['kutu-a']);
    await sssIceAktar([satir('kutu-a', IKI), '', '   ', satir('yok', IKI)], s.dep);
    expect(s.kutuk).toHaveLength(2);
    expect(s.kutuk[0]).toMatchObject({ satir: 1, handle: 'kutu-a', sonuc: 'dry-run-yazilacak', kip: 'dry-run', soruSayisi: 2 });
    expect(s.kutuk[1]).toMatchObject({ satir: 4, handle: 'yok', sonuc: 'urun-yok' });
    expect(s.kutuk.every((k) => typeof k.sebep === 'string' && k.sebep.length > 0)).toBe(true);
  });

  it('9) aynı handle girdide iki kez → ikincisi reddedilir (çift yazma yok)', async () => {
    const s = sahte(['kutu-a']);
    const o = await sssIceAktar([satir('kutu-a', IKI), satir('kutu-a', IKI)], s.dep, { uygula: true });
    expect(o.yazildi).toBe(1);
    expect(o.reddedildi).toBe(1);
    expect(s.say.yaz).toBe(1);
  });

  it('10) senkron hatası sessiz geçmez: DB yazıldı ama "yazildi-senkron-hatasi" + sebep', async () => {
    const s = sahte(['kutu-a'], {}, 'SSS_METAFIELD_SENKRON kapalı');
    const o = await sssIceAktar([satir('kutu-a', IKI)], s.dep, { uygula: true });
    expect(o['yazildi-senkron-hatasi']).toBe(1);
    expect(s.kutuk[0]!.sebep).toContain('SSS_METAFIELD_SENKRON');
  });

  it('11) bağımlılık istisna atarsa o satır "hata" olur, sonraki satır yine işlenir', async () => {
    const s = sahte(['kutu-a', 'kutu-b']);
    const dep = { ...s.dep, mevcutOku: async (h: string) => { if (h === 'kutu-a') throw new Error('db koptu'); return []; } };
    const o = await sssIceAktar([satir('kutu-a', IKI), satir('kutu-b', IKI)], dep, { uygula: true });
    expect(o.hata).toBe(1);
    expect(o.yazildi).toBe(1);
    expect(s.kutuk[0]!.sebep).toContain('db koptu');
  });

  it('12) sıra numarası girdideki sıradır (0,1,2…); soru boşlukları sadeleşir', () => {
    const a = satirAyristir(satir('kutu-a', [{ soru: '  Kaç   adet? ', cevap: '3' }, { soru: 'Renk?', cevap: 'Siyah' }]));
    expect(a).toMatchObject({ handle: 'kutu-a', kayitlar: [{ soru: 'Kaç adet?', cevap: '3', sira: 0 }, { soru: 'Renk?', cevap: 'Siyah', sira: 1 }] });
  });
});
