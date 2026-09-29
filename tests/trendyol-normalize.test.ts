import { describe, expect, it } from 'vitest';
import { extractImages, normalizeTrendyolRow } from '../src/lib/trendyol/normalize';
import { extractErrorMessage, extractRows } from '../src/lib/trendyol/client';
import type { TrendyolRawRow } from '../src/lib/trendyol/types';

describe('normalizeTrendyolRow', () => {
  it('standart bir content satırını tam eşler', () => {
    const row: TrendyolRawRow = {
      barcode: 'BR123',
      stockCode: 'SK-9',
      productMainId: 777,
      title: 'Lisanslı Çocuk Tişörtü',
      brand: { name: 'Disney' },
      category: { name: 'Çocuk Giyim', id: 411 },
      quantity: 12,
      listPrice: 199.9,
      salePrice: 149.9,
      vatRate: 10,
      currencyType: 'TRY',
      approved: true,
      onSale: true,
      images: [{ url: 'https://cdn/1.jpg' }, { url: 'https://cdn/2.jpg' }],
    };
    const p = normalizeTrendyolRow(row);
    expect(p).toMatchObject({
      barcode: 'BR123',
      stockCode: 'SK-9',
      productMainId: '777',
      title: 'Lisanslı Çocuk Tişörtü',
      brand: 'Disney',
      categoryName: 'Çocuk Giyim',
      categoryId: '411',
      quantity: 12,
      listPrice: 199.9,
      salePrice: 149.9,
      vatRate: 10,
      currency: 'TRY',
      approved: true,
      onSale: true,
    });
    expect(p.images).toEqual(['https://cdn/1.jpg', 'https://cdn/2.jpg']);
  });

  it('brand string, category düz alan, quantity fallback (stockAmount) çalışır', () => {
    const p = normalizeTrendyolRow({
      barcode: 'X',
      name: 'Alternatif İsim',
      brandName: 'MarkaX',
      categoryName: 'Ev',
      stockAmount: 5,
    });
    expect(p.title).toBe('Alternatif İsim');
    expect(p.brand).toBe('MarkaX');
    expect(p.categoryName).toBe('Ev');
    expect(p.quantity).toBe(5);
  });

  it('eksik fiyat null, eksik barkod boş, negatif/ondalık stok normalize', () => {
    const p = normalizeTrendyolRow({ productName: 'Y', quantity: -3.6 });
    expect(p.salePrice).toBeNull();
    expect(p.listPrice).toBeNull();
    expect(p.barcode).toBe('');
    expect(p.quantity).toBe(0); // negatif → 0
    expect(p.currency).toBe('TRY'); // default
  });

  it('barkod yoksa ean/gtin fallback; currency currencyType\'tan', () => {
    const p = normalizeTrendyolRow({ ean: '869123', title: 'Z', quantity: 1, currencyType: 'USD' });
    expect(p.barcode).toBe('869123');
    expect(p.currency).toBe('USD');
  });

  it('ondalık stok yukarı/aşağı yuvarlanır ve non-negatif kalır', () => {
    expect(normalizeTrendyolRow({ title: 'a', quantity: 4.2 }).quantity).toBe(4);
    expect(normalizeTrendyolRow({ title: 'a', quantity: 4.8 }).quantity).toBe(5);
  });
});

describe('extractImages', () => {
  it('images boşsa mainImage fallback', () => {
    expect(extractImages({ mainImage: { url: 'https://m.jpg' } })).toEqual(['https://m.jpg']);
  });
  it('images boşsa productMainImage (string) fallback', () => {
    expect(extractImages({ productMainImage: 'https://p.jpg' })).toEqual(['https://p.jpg']);
  });
  it('tekrar eden görseller tekilleştirilir', () => {
    expect(extractImages({ images: ['https://a.jpg', 'https://a.jpg', 'https://b.jpg'] })).toEqual([
      'https://a.jpg',
      'https://b.jpg',
    ]);
  });
  it('hiç görsel yoksa boş dizi', () => {
    expect(extractImages({ title: 'x' })).toEqual([]);
  });
});

describe('extractRows', () => {
  it('content / data / items / düz dizi hepsini tanır', () => {
    expect(extractRows({ content: [{ barcode: '1' }] })).toHaveLength(1);
    expect(extractRows({ data: [{ barcode: '1' }, { barcode: '2' }] })).toHaveLength(2);
    expect(extractRows({ items: [{ barcode: '1' }] })).toHaveLength(1);
    expect(extractRows([{ barcode: '1' }])).toHaveLength(1);
  });
  it('tanınmayan gövde → boş dizi', () => {
    expect(extractRows({ foo: 'bar' })).toEqual([]);
    expect(extractRows(null)).toEqual([]);
  });
});

describe('extractErrorMessage', () => {
  it('message / errors[].message / error / string önceliği', () => {
    expect(extractErrorMessage({ message: 'hata1' })).toBe('hata1');
    expect(extractErrorMessage({ errors: [{ message: 'hata2' }] })).toBe('hata2');
    expect(extractErrorMessage({ error: 'hata3' })).toBe('hata3');
    expect(extractErrorMessage('düz metin hata')).toBe('düz metin hata');
    expect(extractErrorMessage({})).toBe('');
  });
});
