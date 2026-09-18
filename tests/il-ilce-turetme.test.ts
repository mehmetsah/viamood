/**
 * #1519 / #615 / #631 — ilçeden il türetme.
 * Ölçüm: son 30 günde 57 siparişin 25'inde (%44) province boş, city (ilçe) hep dolu.
 */
import { describe, expect, it } from 'vitest';
import { ilceIlBul } from '@/lib/tr-addresses';

describe('ilceIlBul — ASCII yazım', () => {
  it('kadikoy → İstanbul', () => expect(ilceIlBul('kadikoy')).toBe('İstanbul'));
  it('esenyurt → İstanbul', () => expect(ilceIlBul('esenyurt')).toBe('İstanbul'));
  it('selcuklu → Konya', () => expect(ilceIlBul('selcuklu')).toBe('Konya'));
  it('odunpazari → Eskişehir', () => expect(ilceIlBul('odunpazari')).toBe('Eskişehir'));
  it('bornova → İzmir', () => expect(ilceIlBul('bornova')).toBe('İzmir'));
});

describe('ilceIlBul — gerçek Türkçe yazım', () => {
  it('Kadıköy → İstanbul', () => expect(ilceIlBul('Kadıköy')).toBe('İstanbul'));
  it('KADIKÖY (büyük) → İstanbul', () => expect(ilceIlBul('KADIKÖY')).toBe('İstanbul'));
  it('Şişli → İstanbul', () => expect(ilceIlBul('Şişli')).toBe('İstanbul'));
  it('Çankaya → Ankara', () => expect(ilceIlBul('Çankaya')).toBe('Ankara'));
});

describe('ilceIlBul — biçim toleransı', () => {
  it('boşluklu ve bitişik yazım aynı ile düşer', () => {
    expect(ilceIlBul('Şehit Kamil')).toBe(ilceIlBul('şehitkamil'));
  });
  it('baştaki/sondaki boşluk yutulur', () => expect(ilceIlBul('  Bornova  ')).toBe('İzmir'));
});

describe('ilceIlBul — uydurmaz', () => {
  it('bilinmeyen ilçe null döner', () => expect(ilceIlBul('yokboyleilce')).toBeNull());
  it('boş metin null döner', () => expect(ilceIlBul('')).toBeNull());
  it('null/undefined null döner', () => {
    expect(ilceIlBul(null)).toBeNull();
    expect(ilceIlBul(undefined)).toBeNull();
  });
});
