/**
 * #994831 · KAYNAKLI AÇIKLAMA UYGULAMA ÇİVİSİ (pilot 5 · dalga 2).
 * MUTASYON: «öncesi = canlı» kapısı, birebir hedef kapısı, metin kapısı, iç blok/yasak sözcük kapısı, kalite kapısı,
 * yeniden okuma ya da dry-run kaldırılırsa ilgili iddialar KIRILIR.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ekleCalistir, kaliteKapisi, karar, type Giris, type KutukSatiri } from '../src/lib/aciklama-ekle';

const oku = (f: string) => readFileSync(path.join(__dirname, '..', 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Giris);
const PILOT = oku('994831-aciklama-pilot.jsonl');
const D2 = oku('994831-aciklama-dalga2.jsonl');

describe('pilot (5 ürün, açıklaması 0 bayt)', () => {
  it('açıklama BOŞKEN yazılacak HTML jsonl taslağıyla BİREBİR (bayt bayt)', () => {
    expect(PILOT).toHaveLength(5);
    for (const g of PILOT) {
      const k = karar(g, '');
      if (k.durum !== 'yazilacak') throw new Error(`${g.handle}: ${k.durum} ${'sebep' in k ? k.sebep : ''}`);
      expect(Buffer.from(k.html).equals(Buffer.from(g.taslakHtml!))).toBe(true);
    }
  });
  it('NEGATİF: açıklama artık boş değilse (başka tur yazmış) ATLANIR', () => {
    expect(karar(PILOT[0]!, '<p>Başka bir metin.</p>')).toMatchObject({ durum: 'atlandi' });
  });
  it('zaten yazılıysa değişiklik-yok (idempotans)', () => {
    expect(karar(PILOT[0]!, PILOT[0]!.taslakHtml!)).toMatchObject({ durum: 'degisiklik-yok' });
  });
});

describe('dalga 2 (6 ürün; kısa açıklamada mevcut metin korunur)', () => {
  it('canlı = mevcutHtml iken yazılacak HTML = mevcut + ek = hedefHtml (bayt bayt); mevcut metin başta AYNEN', () => {
    expect(D2).toHaveLength(6);
    for (const g of D2) {
      const k = karar(g, g.mevcutHtml!, { kalite: true });
      if (k.durum !== 'yazilacak') throw new Error(`${g.handle}: ${k.durum} ${'sebep' in k ? k.sebep : ''}`);
      expect(k.html).toBe(g.hedefHtml);
      expect(k.html.startsWith(g.mevcutHtml!)).toBe(true);
    }
  });
  it('NEGATİF: mevcut açıklama taslaktaki öncesinden farklıysa ATLANIR (mevcut metin ezilmez)', () => {
    const g = D2.find((x) => (x.mevcutHtml ?? '').length > 0)!;
    expect(karar(g, g.mevcutHtml + '<p>sonradan eklenen</p>', { kalite: true })).toMatchObject({ durum: 'atlandi' });
  });
  it('KALİTE KAPISI: 10 satırdan az ya da Teknik Bilgiler\'de ölçek/malzeme/paket adedi yoksa ATLANIR', () => {
    const ince: Giris = { handle: 'x', baslik: 'X', mevcutHtml: '', ekHtml: '<p>Tek satır.</p>', hedefHtml: '<p>Tek satır.</p>', eslem: [{ bolum: 'gövde', metin: 'Tek satır.' }] };
    expect(kaliteKapisi(ince).gecti).toBe(false);
    expect(karar(ince, '', { kalite: true })).toMatchObject({ durum: 'atlandi' });
    const teknikYok: Giris = { ...ince, eslem: Array.from({ length: 12 }, (_, i) => ({ bolum: 'Teknik Bilgiler', metin: `Marka: ${i}` })) };
    expect(kaliteKapisi(teknikYok).gecti).toBe(false);
    for (const g of D2) expect(kaliteKapisi(g).gecti, g.handle).toBe(true);
  });
});

describe('ek kapıları', () => {
  const g = (ek: string): Giris => ({ handle: 'x', baslik: 'Hot Wheels X', mevcutHtml: '', ekHtml: ek, hedefHtml: ek });
  it('NEGATİF: ek kuyruk iç bloğu ya da baş iç dizisi getiriyorsa ATLANIR', () => {
    expect(karar(g('<p>Gövde cümlesi burada.</p><p>Ürün Etiketleri (SEO)</p><p>hot wheels, metal araba, koleksiyon</p>'), '')).toMatchObject({ durum: 'atlandi' });
    expect(karar(g('<h2>Shopify Ürün Açıklaması</h2><p>Gövde cümlesi burada.</p>'), '')).toMatchObject({ durum: 'atlandi' });
  });
  it('NEGATİF (yalıtılmış — yasak sözcük listesine takılmayan iç bloklar): «Ürün Başlığı» baş dizisi ve «Kategori» kırıntı kuyruğu ATLANIR', () => {
    expect(karar(g('<h2>Ürün Başlığı</h2><p>Hot Wheels X Metal Araba</p><p>Gövde cümlesi burada.</p>'), '')).toMatchObject({ durum: 'atlandi' });
    expect(karar(g('<p>Gövde cümlesi burada.</p><p>Kategori</p><p>Oyuncak &gt; Araba &gt; Metal</p>'), '')).toMatchObject({ durum: 'atlandi' });
  });
  it('NEGATİF: ek kargo/iade/sohbet artığı içeriyorsa ATLANIR', () => {
    expect(karar(g('<p>Kargo aynı gün çıkar.</p>'), '')).toMatchObject({ durum: 'atlandi' });
    expect(karar(g('<p>Bu konuşma şimdiye kadar faydalı oldu mu?</p>'), '')).toMatchObject({ durum: 'atlandi' });
  });
  it('NEGATİF: öncesi + ek hedefle birebir değilse ATLANIR', () => {
    expect(karar({ ...g('<p>A.</p>'), hedefHtml: '<p>A.</p><p>B.</p>' }, '')).toMatchObject({ durum: 'atlandi' });
  });
});

describe('çalıştırıcı', () => {
  const p = PILOT[0]!;
  const dep = (db: { h: string }, k: KutukSatiri[], degisti = false) => ({
    bul: async (handle: string) => ({ id: 'gid://shopify/Product/1', handle, html: db.h }),
    oku: async () => (degisti ? db.h + 'x' : db.h),
    yaz: async (_: string, h: string) => { db.h = h; return { ok: true as const }; },
    kutuk: (s: KutukSatiri) => k.push(s),
  });
  it('dry-run yaz çağırmaz', async () => {
    const db = { h: '' }; const k: KutukSatiri[] = [];
    expect(await ekleCalistir([p], dep(db, k), { uygula: false })).toMatchObject({ yazilacak: 1, yazildi: 0 });
    expect(db.h).toBe('');
  });
  it('uygula: taslağı BİREBİR yazar, kütüğe ÖNCESİ (0 bayt) düşer; ikinci koşu değişiklik-yok', async () => {
    const db = { h: '' }; const k: KutukSatiri[] = [];
    expect(await ekleCalistir([p], dep(db, k), { uygula: true })).toMatchObject({ yazildi: 1 });
    expect(db.h).toBe(p.taslakHtml); expect(k[0]).toMatchObject({ durum: 'yazildi', onceHtml: '', onceBayt: 0 });
    expect(await ekleCalistir([p], dep(db, k), { uygula: true })).toMatchObject({ yazildi: 0, degisiklikYok: 1 });
  });
  it('okuma ile yazma arasında açıklama değiştiyse yazmaz', async () => {
    const db = { h: '' };
    expect(await ekleCalistir([p], dep(db, [], true), { uygula: true })).toMatchObject({ yazildi: 0, atlandi: 1 });
  });
});
