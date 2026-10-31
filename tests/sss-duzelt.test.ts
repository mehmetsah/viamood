/**
 * #994831 · JADA STITCH SSS BOYUT CEVABI · ÇİVİ (Mehmet kararı 1 Kas 2026: kaynaklı değere çek, soruyu düşürme).
 * Girdi: veri/994831-sss-jada-boyut.jsonl · anlık görüntü veri/994831-sss-jada-boyut-kaynak.jsonl (Admin API 31 Eki 22:10Z:
 * güncel açıklama + canlı SSS kümesi). Açıklama #994831 Jada ölçü turunda düzeltildi (merge bf7d3c1); SSS eski
 * «Boyut: 6,35 cm (2.5").» cevabını taşıyordu.
 * MUTASYON: öncesi/metin/eksen/yasak/küme kapıları, dry-run, yeniden okuma kaldırılırsa ilgili iddialar KIRILIR.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { duzeltCalistir, karar, type KutukSatiri, type SssDuzeltGiris } from '../src/lib/sss-duzelt';
import { duzMetin } from '../src/lib/aciklama-ic-not';
import type { SssKayit } from '../src/lib/urun-sss';

const satir = <T,>(f: string) => readFileSync(path.join(__dirname, '..', 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as T);
const G = satir<SssDuzeltGiris & { sku: string }>('994831-sss-jada-boyut.jsonl');
const K = new Map(satir<{ handle: string; html: string; sss: SssKayit[] }>('994831-sss-jada-boyut-kaynak.jsonl').map((x) => [x.handle, x]));
const YASAK = ['6,35', '6,5 cm', '2.5"', '2,5"'];
const kesin = (k: ReturnType<typeof karar>) => { if (k.durum !== 'yazilacak') throw new Error(`${k.durum}: ${'sebep' in k ? k.sebep : ''}`); return k; };

describe('veri', () => {
  it('tam 4 ürün (SKU 505-508 Jada Stitch), hepsi «Boyutu nedir?», öncesi «Boyut: 6,35 cm (2.5").»', () => {
    expect(G.map((g) => g.sku)).toEqual(['505', '506', '507', '508']);
    expect(new Set(G.map((g) => g.handle)).size).toBe(4);
    for (const g of G) { expect(g.handle).toMatch(/^jada-disney-.*stitch/); expect(g.soru).toBe('Boyutu nedir?'); expect(g.onceCevap).toBe('Boyut: 6,35 cm (2.5").'); expect(g.anahtar).toBe('Boyut'); expect(g.eksen).toBe('Ölçüleri nedir?'); }
    expect(G.slice(0, 3).map((g) => g.yeniCevap)).toEqual(Array(3).fill('Yaklaşık 5 cm (2 inç)'));
    expect(G[3]!.yeniCevap).toBe('Yaklaşık 5,7 cm (2,25 inç)');
    for (const g of G) expect(g.kaynak).toMatch(new RegExp(`/files/${g.sku}-\\d\\.jpg`));
  });
});

describe('karar', () => {
  it('canlı küme + güncel açıklamayla yazılacak; yalnız bu cevap değişir, soru/sıra/öteki cevaplar aynı', () => {
    for (const g of G) {
      const k = K.get(g.handle)!; const r = kesin(karar(g, k.sss, k.html));
      expect(r.yeni).toHaveLength(k.sss.length);
      const fark = r.yeni.map((x, i) => [x, k.sss[i]!] as const).filter(([a, b]) => JSON.stringify(a) !== JSON.stringify(b));
      expect(fark).toHaveLength(1);
      expect(fark[0]![0]).toEqual({ ...fark[0]![1], cevap: g.yeniCevap });
    }
  });
  it('yeni cevapta 6,35 / 6,5 cm / 2.5" GEÇMEZ; cevap ve «Boyut <cevap>» güncel açıklamanın düz metninde BİREBİR geçer', () => {
    for (const g of G) {
      for (const y of YASAK) expect(g.yeniCevap.includes(y), `${g.sku} ${y}`).toBe(false);
      const d = duzMetin(K.get(g.handle)!.html);
      expect(d).toContain(g.yeniCevap); expect(d).toContain(`Boyut ${g.yeniCevap}`);
      for (const y of ['6,35', '2.5"']) expect(d.includes(y)).toBe(false);
    }
  });
  it('idempotans: canlı zaten yeni cevapsa değişiklik-yok', () => {
    for (const g of G) { const k = K.get(g.handle)!; expect(karar(g, kesin(karar(g, k.sss, k.html)).yeni, k.html)).toMatchObject({ durum: 'degisiklik-yok' }); }
  });
});

describe('kapılar (negatif)', () => {
  const g = G[0]!, k = K.get(g.handle)!;
  it('canlı cevap öncesinden farklıysa YAZMAZ', () => {
    expect(karar(g, k.sss.map((x) => (x.soru === g.soru ? { ...x, cevap: 'Boyut: 7 cm.' } : x)), k.html)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('öncesinden farklı') });
  });
  it('soru yoksa ya da iki kez geçiyorsa YAZMAZ', () => {
    expect(karar(g, k.sss.filter((x) => x.soru !== g.soru), k.html)).toMatchObject({ durum: 'atlandi' });
    expect(karar(g, [...k.sss, { soru: g.soru, cevap: g.onceCevap, sira: 99 }], k.html)).toMatchObject({ durum: 'atlandi' });
  });
  it('metin kapısı: yeni cevap açıklamada yoksa (uydurma 6 cm) ya da anahtarıyla eşleşmiyorsa YAZMAZ', () => {
    expect(karar({ ...g, yeniCevap: 'Yaklaşık 6 cm' }, k.sss, k.html)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('metin kapısı') });
    expect(karar({ ...g, anahtar: 'Malzeme' }, k.sss, k.html)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('metin kapısı') });
    expect(karar(g, k.sss, k.html.replace('Yaklaşık 5 cm (2 inç)', 'Yaklaşık 6 cm'))).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('metin kapısı') });
  });
  it('eksen kapısı: ölçü olmayan değer (Malzeme satırı) ölçü sorusuna YAZILMAZ', () => {
    expect(karar({ ...g, anahtar: 'Malzeme', yeniCevap: 'Die-Cast Metal' }, k.sss, k.html)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('eksen kapısı') });
  });
  it('yasak değer yeni cevapta kalırsa ya da öncesinde sorun yoksa YAZMAZ', () => {
    const h = k.html.replace('Yaklaşık 5 cm (2 inç)', 'Yaklaşık 6,35 cm (2 inç)');
    expect(karar({ ...g, yeniCevap: 'Yaklaşık 6,35 cm (2 inç)' }, k.sss, h)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('yasak değer') });
    expect(karar({ ...g, yasak: ['9,99 cm'] }, k.sss, k.html)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('ölçülmedi') });
  });
});

describe('çalıştırıcı', () => {
  const sahte = (okuFark = false) => {
    const db = new Map([...K.values()].map((x) => [x.handle, x.sss.map((s) => ({ ...s }))]));
    db.set('baska-urun', [{ soru: 'Boyutu nedir?', cevap: 'Boyut: 6,35 cm (2.5").', sira: 0 }]);
    const yazilan: string[] = [], senk: string[] = [], kutuk: KutukSatiri[] = []; let okuma = 0;
    return {
      db, yazilan, senk, kutuk,
      dep: {
        mevcutOku: async (h: string) => { okuma++; const v = (db.get(h) ?? []).map((s) => ({ ...s })); return okuFark && okuma % 2 === 0 ? v.map((s) => ({ ...s, cevap: s.cevap + ' ' })) : v; },
        aciklamaOku: async (h: string) => K.get(h)?.html ?? null,
        yaz: async (h: string, sira: number, once: string, yeni: string) => { const s = db.get(h)!.find((x) => x.sira === sira && x.cevap === once)!; s.cevap = yeni; yazilan.push(h); },
        senkronla: async (h: string) => { senk.push(h); return { ok: true as const }; },
        kutuk: (s: KutukSatiri) => kutuk.push(s),
      },
    };
  };
  it('başka ürünün SSS\'ine dokunmaz: tam 4 yazım + 4 senkron, kütükte ÖNCESİ küme', async () => {
    const s = sahte();
    expect(await duzeltCalistir(G, s.dep, { uygula: true })).toMatchObject({ taranan: 4, yazildi: 4, atlandi: 0, hata: 0 });
    expect(s.yazilan.sort()).toEqual(G.map((g) => g.handle).sort());
    expect(s.senk).toHaveLength(4);
    expect(s.db.get('baska-urun')![0]!.cevap).toBe('Boyut: 6,35 cm (2.5").');
    for (const k of s.kutuk) expect(k.once?.some((x) => x.cevap === 'Boyut: 6,35 cm (2.5").')).toBe(true);
  });
  it('dry-run varsayılanında yaz ve senkron HİÇ çağrılmaz', async () => {
    const s = sahte();
    expect(await duzeltCalistir(G, s.dep, { uygula: false })).toMatchObject({ yazilacak: 4, yazildi: 0 });
    expect([...s.yazilan, ...s.senk]).toEqual([]);
  });
  it('okuma ile yazma arasında SSS değiştiyse yazmaz', async () => {
    const s = sahte(true);
    expect(await duzeltCalistir(G, s.dep, { uygula: true })).toMatchObject({ yazildi: 0, atlandi: 4 });
    expect(s.yazilan).toEqual([]);
  });
  it('ikinci koşu hiçbir şey yazmaz', async () => {
    const s = sahte(); await duzeltCalistir(G, s.dep, { uygula: true }); s.yazilan.length = 0;
    expect(await duzeltCalistir(G, s.dep, { uygula: true })).toMatchObject({ degisiklikYok: 4, yazildi: 0 });
    expect(s.yazilan).toEqual([]);
  });
  it('betik DB\'de tek satırı (handle + sıra + eski cevap) günceller ve 1 satır şartı arar', () => {
    const b = readFileSync(path.join(__dirname, '..', 'scripts', 'sss-duzelt.mts'), 'utf8');
    expect(b).toContain('eq(urunSss.urunHandle, handle), eq(urunSss.sira, sira), eq(urunSss.cevap, onceCevap)');
    expect(b).toContain('r.length !== 1');
    expect(b).not.toMatch(/\.delete\(|\.insert\(|productUpdate|metafieldDelete/);
  });
});
