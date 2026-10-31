/**
 * #994831 · SSS İADE SORUSU DÜŞÜRME · ÇİVİ (koordinasyon kararı 1 Kas 2026, md.46 — temizlik, acil düzeltme değil).
 * Girdi: veri/994831-sss-iade-dusur.jsonl · anlık görüntü veri/994831-sss-iade-dusur-kaynak.jsonl (DB urun_sss salt okuma,
 * 1 Kas 01:5x: iki ürün × 3 açık satır). Satır SİLİNMEZ; `acik=false` + metafield senkronu.
 * MUTASYON: eksen/tekillik/öncesi/küme kapıları, ÖNCESİ-önce kütük sırası, dry-run, yeniden okuma kaldırılırsa KIRILIR.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dusurCalistir, karar, type KutukSatiri, type SssDusurGiris, type SssSatir } from '../src/lib/sss-dusur';

const satir = <T,>(f: string) => readFileSync(path.join(__dirname, '..', 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as T);
const G = satir<SssDusurGiris>('994831-sss-iade-dusur.jsonl');
const K = new Map(satir<{ handle: string; satirlar: SssSatir[] }>('994831-sss-iade-dusur-kaynak.jsonl').map((x) => [x.handle, x.satirlar]));
const IADE = 'İade edebilir miyim?';
const kesin = (k: ReturnType<typeof karar>) => { if (k.durum !== 'yazilacak') throw new Error(`${k.durum}: ${'sebep' in k ? k.sebep : ''}`); return k; };
const kopya = (h: string) => K.get(h)!.map((x) => ({ ...x }));

describe('veri', () => {
  it('tam 2 ürün, yalnız «İade edebilir miyim?», öncesi cevap «14 gün … 10 gün» (politikayla tutarlı), gerekçe yazılı', () => {
    expect(G.map((g) => g.handle).sort()).toEqual(['snackles-aburcubur-pelus-20-cm-s2-sally-fruit-tella-zuru-5ua04000', 'tripot-model-3lu-saksi-seti']);
    for (const g of G) {
      expect(g.soru).toBe(IADE);
      expect(g.onceCevap).toMatch(/14 gün içinde .* 10 gün içinde/);
      expect(g.gerekce).toContain('iade-ve-teslimat');
      expect(K.get(g.handle)!.filter((x) => x.acik)).toHaveLength(3);
    }
  });
});

describe('karar', () => {
  it('yalnız iade satırı düşer: 3 → 2 açık soru; kalanların soru/cevap/sıra değerleri bayt bayt aynı', () => {
    for (const g of G) {
      const once = K.get(g.handle)!, r = kesin(karar(g, once));
      expect(r.yeniAcik).toHaveLength(2);
      expect(r.yeniAcik).toEqual(once.filter((x) => x.acik && x.soru !== IADE).map(({ soru, cevap, sira }) => ({ soru, cevap, sira })));
      expect(JSON.stringify(r.yeniAcik)).not.toMatch(/İade|14 gün|10 gün|cayma/);
    }
  });
  it('idempotans: satır zaten kapalıysa değişiklik-yok', () => {
    for (const g of G) expect(karar(g, kopya(g.handle).map((x) => (x.soru === IADE ? { ...x, acik: false } : x)))).toMatchObject({ durum: 'degisiklik-yok' });
  });
});

describe('kapılar (negatif)', () => {
  const g = G[0]!;
  it('kural dışı eksende olmayan soru DÜŞÜRÜLMEZ', () => {
    expect(karar({ ...g, soru: 'Malzemesi nedir?', onceCevap: 'Plastiktir ve kolay temizlenir.' }, K.get(g.handle)!)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('kural dışı') });
  });
  it('canlı cevap öncesinden farklıysa YAZMAZ', () => {
    expect(karar(g, kopya(g.handle).map((x) => (x.soru === IADE ? { ...x, cevap: x.cevap + ' ' } : x)))).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('öncesinden farklı') });
  });
  it('soru açıkta yoksa ya da iki kez geçiyorsa YAZMAZ', () => {
    expect(karar(g, kopya(g.handle).filter((x) => x.soru !== IADE))).toMatchObject({ durum: 'atlandi' });
    expect(karar(g, [...kopya(g.handle), { soru: IADE, cevap: g.onceCevap, sira: 9, acik: true }])).toMatchObject({ durum: 'atlandi' });
  });
  it('düşünce hiç soru kalmayacaksa YAZMAZ', () => {
    expect(karar(g, kopya(g.handle).filter((x) => x.soru === IADE))).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('küme kapısı') });
  });
});

describe('çalıştırıcı', () => {
  const sahte = (o: { okuFark?: boolean; kutukAtar?: boolean } = {}) => {
    const db = new Map([...K.entries()].map(([h, v]) => [h, v.map((x) => ({ ...x }))]));
    db.set('baska-urun', [{ soru: 'Malzemesi nedir?', cevap: 'Ahşap.', sira: 0, acik: true }, { soru: IADE, cevap: G[0]!.onceCevap, sira: 1, acik: true }]);
    const gizlenen: string[] = [], senk: string[] = [], kutuk: KutukSatiri[] = []; let okuma = 0;
    return {
      db, gizlenen, senk, kutuk,
      dep: {
        oku: async (h: string) => { okuma++; const v = (db.get(h) ?? []).map((x) => ({ ...x })); return o.okuFark && okuma % 2 === 0 ? v.map((x) => ({ ...x, cevap: x.cevap + '!' })) : v; },
        gizle: async (h: string, sira: number, soru: string, once: string) => { const s = db.get(h)!.find((x) => x.sira === sira && x.soru === soru && x.cevap === once && x.acik)!; s.acik = false; gizlenen.push(h); },
        senkronla: async (h: string) => { senk.push(h); return { ok: true as const }; },
        kutuk: (s: KutukSatiri) => { if (o.kutukAtar && s.durum === 'oncesi-kaydedildi') throw new Error('disk dolu'); kutuk.push(s); },
      },
    };
  };
  it('başka ürünün SSS\'ine dokunmaz: tam 2 gizleme + 2 senkron; satırlar silinmez, yalnız acik=false', async () => {
    const s = sahte();
    expect(await dusurCalistir(G, s.dep, { uygula: true })).toMatchObject({ taranan: 2, yazildi: 2, atlandi: 0, hata: 0 });
    expect(s.gizlenen.sort()).toEqual(G.map((g) => g.handle).sort());
    expect(s.senk).toHaveLength(2);
    expect(s.db.get('baska-urun')!.every((x) => x.acik)).toBe(true);
    for (const g of G) { const v = s.db.get(g.handle)!; expect(v).toHaveLength(3); expect(v.filter((x) => x.acik).map((x) => x.soru)).not.toContain(IADE); }
  });
  it('ÖNCESİ küme (soru + TAM cevap) yazma ÖNCESİNDE kütüğe düşer; kütük yazılamazsa gizleme HİÇ koşmaz', async () => {
    const s = sahte();
    await dusurCalistir(G, s.dep, { uygula: true });
    for (const g of G) {
      const ks = s.kutuk.filter((k) => k.handle === g.handle);
      const i = ks.findIndex((k) => k.durum === 'oncesi-kaydedildi'), j = ks.findIndex((k) => k.durum === 'yazildi');
      expect(i).toBeGreaterThanOrEqual(0); expect(j).toBeGreaterThan(i);
      expect(ks[i]!.once!.find((x) => x.soru === IADE)!.cevap).toBe(g.onceCevap);
    }
    const t = sahte({ kutukAtar: true });
    expect(await dusurCalistir(G, t.dep, { uygula: true })).toMatchObject({ yazildi: 0, hata: 2 });
    expect([...t.gizlenen, ...t.senk]).toEqual([]);
  });
  it('dry-run varsayılanında gizleme ve senkron HİÇ çağrılmaz', async () => {
    const s = sahte();
    expect(await dusurCalistir(G, s.dep, { uygula: false })).toMatchObject({ yazilacak: 2, yazildi: 0 });
    expect([...s.gizlenen, ...s.senk]).toEqual([]);
  });
  it('okuma ile yazma arasında SSS değiştiyse yazmaz', async () => {
    const s = sahte({ okuFark: true });
    expect(await dusurCalistir(G, s.dep, { uygula: true })).toMatchObject({ yazildi: 0, atlandi: 2 });
    expect(s.gizlenen).toEqual([]);
  });
  it('ikinci koşu 0 değişiklik', async () => {
    const s = sahte(); await dusurCalistir(G, s.dep, { uygula: true }); s.gizlenen.length = 0; s.senk.length = 0;
    expect(await dusurCalistir(G, s.dep, { uygula: true })).toMatchObject({ degisiklikYok: 2, yazildi: 0 });
    expect([...s.gizlenen, ...s.senk]).toEqual([]);
  });
  it('betik satır SİLMEZ: tek satırda acik=false (handle + sıra + soru + eski cevap + açık), 1 satır şartı', () => {
    const b = readFileSync(path.join(__dirname, '..', 'scripts', 'sss-dusur.mts'), 'utf8');
    expect(b).toContain('.set({ acik: false, updatedAt: new Date() })');
    expect(b).toContain('eq(urunSss.urunHandle, handle), eq(urunSss.sira, sira), eq(urunSss.soru, soru), eq(urunSss.cevap, onceCevap), eq(urunSss.acik, true)');
    expect(b).toContain('r.length !== 1');
    expect(b).not.toMatch(/\.delete\(|\.insert\(|productUpdate|metafieldDelete/);
  });
});
