/**
 * #994831 · KAYNAKLI AÇIKLAMA DALGA 2 · VERİ ÇİVİSİ — kaynak şartı pilotla AYNI (md.52).
 * Her ek satırı bir kaynağa eşlenir; tür yalnız başlık · üretici resmî sayfası · ürünün kendi görselindeki ambalaj
 * metni. Pazaryeri/bayi ve ViaMood'un kendi tanıtım kartı kaynak DEĞİL.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { duzMetin } from '../src/lib/aciklama-ic-not';

type K = { tur: 'baslik' | 'uretici' | 'ambalaj'; kaynak: string; alinti: string };
type T = { handle: string; mevcutHtml: string; ekHtml: string; hedefHtml: string; eslem: Array<{ bolum: string; metin: string; kaynaklar: K[] }>; bosBirakilan: string[] };
const satir = <X,>(f: string) => readFileSync(path.join(__dirname, '..', 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as X);
const D2 = satir<T>('994831-aciklama-dalga2.jsonl');
const parcalar = (html: string) => [...html.matchAll(/<(p|li|tr)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => duzMetin((m[2] ?? '').replace(/<\/t[dh]><t[dh]>/g, ': '))).filter((s) => s !== 'Özellik: Bilgi');

it('dalga 2: 6 ürün; pilotla ve kendi içinde çakışma yok; mevcut açıklama kısa (< 300 karakter) ya da boş', () => {
  const pilot = new Set(satir<{ handle: string }>('994831-aciklama-pilot.jsonl').map((x) => x.handle));
  expect(D2).toHaveLength(6);
  expect(new Set(D2.map((x) => x.handle)).size).toBe(6);
  for (const t of D2) { expect(pilot.has(t.handle)).toBe(false); expect(duzMetin(t.mevcutHtml).length).toBeLessThan(300); }
});

it('KAYNAK ŞARTI: ek HTML\'deki her paragraf/madde/tablo satırı birebir bir eşlemeye karşılık gelir', () => {
  for (const t of D2) {
    const esl = new Set(t.eslem.map((e) => e.metin));
    const s = parcalar(t.ekHtml);
    expect(s.length, t.handle).toBe(t.eslem.length);
    for (const x of s) expect(esl.has(x), `${t.handle} · kaynaksız: ${x}`).toBe(true);
  }
});

it('kaynak türleri: üretici = resmî Mattel alanı, ambalaj = ürünün kendi görseli (cdn.shopify), bayi yasak, alıntı boş değil', () => {
  for (const t of D2) for (const e of t.eslem) {
    expect(e.kaynaklar.length).toBeGreaterThan(0);
    for (const k of e.kaynaklar) {
      expect(['baslik', 'uretici', 'ambalaj']).toContain(k.tur);
      expect(k.alinti.trim().length).toBeGreaterThan(0);
      if (k.tur === 'uretici') expect(k.kaynak).toMatch(/^https:\/\/(shop|shopping|creations)\.mattel\.com\//);
      if (k.tur === 'ambalaj') expect(k.kaynak).toMatch(/^https:\/\/cdn\.shopify\.com\//);
      expect(k.kaynak).not.toMatch(/amazon|trendyol|hepsiburada|ebay|walmart|kmart|smyths|akakce|bigbadtoystore|n11|ChatGPT/i);
    }
  }
});

it('mevcut metin KORUNUR: hedef = mevcut + ek; boş bırakılan alanlar gerekçeli', () => {
  for (const t of D2) { expect(t.hedefHtml).toBe(t.mevcutHtml + t.ekHtml); expect(t.bosBirakilan.length).toBeGreaterThan(0); }
});
