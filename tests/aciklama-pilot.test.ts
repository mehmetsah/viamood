/**
 * #994831 · BOŞ AÇIKLAMA PİLOTU (5 ürün) · TASLAK ÇİVİSİ — canlıya YAZILMAZ, yalnız veri.
 * Kaynak şartı (md.52): taslaktaki HER cümle/madde/tablo satırı en az bir kaynağa eşlenir; kaynak türü yalnız
 * ürün başlığı · üreticinin resmî sayfası · ürünün kendi görselindeki ambalaj metni. Pazaryeri/bayi kaynak değildir.
 * MUTASYON: kaynaksız bir cümle eklenirse, bir eşleme silinirse, bayi adresi kaynak gösterilirse ya da temizlediğimiz
 * iç blok sınıflarından biri taslağa girerse ilgili iddia KIRILIR.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { duzMetin } from '../src/lib/aciklama-ic-not';
import { kuyrukBul } from '../src/lib/aciklama-pazar-blok';
import { basDiziBul } from '../src/lib/aciklama-bas-blok';

type Kaynak = { tur: 'baslik' | 'uretici' | 'ambalaj'; kaynak: string; alinti: string };
type T = { handle: string; baslik: string; mevcutAciklamaBayt: number; taslakHtml: string; eslem: Array<{ bolum: string; metin: string; kaynaklar: Kaynak[] }>; bosBirakilan: string[] };
const T = readFileSync(path.join(__dirname, '..', 'veri', '994831-aciklama-pilot.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as T);
const URETICI = /^https:\/\/(shop|shopping|creations)\.mattel\.com\//;
const AMBALAJ = /^https:\/\/cdn\.shopify\.com\//;
const parcalar = (html: string) => [...html.matchAll(/<(p|li|tr)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => duzMetin((m[2] ?? '').replace(/<\/t[dh]><t[dh]>/g, ': ')));

it('pilot: 5 ürün, hepsi şu an BOŞ açıklamalı (yalnız boş açıklamaya taslak)', () => {
  expect(T).toHaveLength(5);
  for (const t of T) expect(t.mevcutAciklamaBayt, t.handle).toBe(0);
});

it('KAYNAK ŞARTI: taslaktaki her paragraf/madde/tablo satırı birebir bir eşlemeye karşılık gelir; eşlemesiz satır yok', () => {
  for (const t of T) {
    const esl = new Set(t.eslem.map((e) => e.metin));
    const satirlar = parcalar(t.taslakHtml).filter((s) => s !== 'Özellik: Bilgi');
    expect(satirlar.length, t.handle).toBe(t.eslem.length);
    for (const s of satirlar) expect(esl.has(s), `${t.handle} · kaynaksız: ${s}`).toBe(true);
  }
});

it('her eşlemenin en az bir kaynağı var; tür yalnız başlık/üretici/ambalaj; üretici = resmî Mattel alanı, ambalaj = ürünün kendi görseli; alıntı boş değil', () => {
  for (const t of T) for (const e of t.eslem) {
    expect(e.kaynaklar.length, `${t.handle} · ${e.metin}`).toBeGreaterThan(0);
    for (const k of e.kaynaklar) {
      expect(['baslik', 'uretici', 'ambalaj']).toContain(k.tur);
      expect(k.alinti.trim().length).toBeGreaterThan(0);
      if (k.tur === 'uretici') expect(k.kaynak, `${t.handle}: üretici kaynağı resmî değil`).toMatch(URETICI);
      if (k.tur === 'ambalaj') expect(k.kaynak).toMatch(AMBALAJ);
      expect(k.kaynak).not.toMatch(/amazon|trendyol|hepsiburada|ebay|walmart|kmart|smyths|akakce|bigbadtoystore|n11/i);
    }
  }
});

it('temizlenen sınıflar geri gelmez: iç blok kuyruğu/baş dizisi yok, pazar yeri/SEO/sohbet sözcüğü yok, kargo/iade yok', () => {
  for (const t of T) {
    expect('yok' in kuyrukBul(t.taslakHtml, t.baslik), t.handle).toBe(true);
    expect('yok' in basDiziBul(t.taslakHtml, t.baslik), t.handle).toBe(true);
    const d = duzMetin(t.taslakHtml).toLocaleLowerCase('tr');
    expect(d).not.toMatch(/trendyol|shopify|seo|etiketleri|meta alan|bu konuşma|kargo|teslimat|iade|garanti|\?/);
  }
});

it('emin olunmayan alanlar BOŞ bırakıldı ve gerekçesiyle listelendi', () => {
  for (const t of T) expect(t.bosBirakilan.length, t.handle).toBeGreaterThan(0);
});
