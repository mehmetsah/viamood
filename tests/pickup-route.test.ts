import { describe, expect, it } from 'vitest';
import { buildPickupRoute, type PickupRouteStopInput } from '../src/lib/routing/pickup-route';

function g(partial: Partial<PickupRouteStopInput> & { vendorId: string }): PickupRouteStopInput {
  return {
    vendorName: partial.vendorId,
    city: null,
    district: null,
    itemCount: 1,
    totalQuantity: 1,
    lineItemIds: [],
    ...partial,
  };
}

describe('buildPickupRoute', () => {
  it('aynı şehirdeki tedarikçileri bitişik tutar', () => {
    const route = buildPickupRoute([
      g({ vendorId: 'A', city: 'İstanbul', totalQuantity: 5 }),
      g({ vendorId: 'B', city: 'Ankara', totalQuantity: 4 }),
      g({ vendorId: 'C', city: 'İstanbul', totalQuantity: 3 }),
    ]);
    const cities = route.map((r) => r.city);
    // İstanbul yükü (8) > Ankara (4) → önce iki İstanbul, sonra Ankara.
    expect(cities).toEqual(['İstanbul', 'İstanbul', 'Ankara']);
    expect(route.map((r) => r.seq)).toEqual([1, 2, 3]);
  });

  it('şehir yükü azalan sıralanır', () => {
    const route = buildPickupRoute([
      g({ vendorId: 'az', city: 'İzmir', totalQuantity: 2 }),
      g({ vendorId: 'cok', city: 'Bursa', totalQuantity: 20 }),
    ]);
    expect(route[0]!.city).toBe('Bursa');
    expect(route[1]!.city).toBe('İzmir');
  });

  it('şehir içi adet azalan', () => {
    const route = buildPickupRoute([
      g({ vendorId: 'kucuk', city: 'Konya', totalQuantity: 1 }),
      g({ vendorId: 'buyuk', city: 'Konya', totalQuantity: 9 }),
    ]);
    expect(route.map((r) => r.vendorId)).toEqual(['buyuk', 'kucuk']);
  });

  it('şehri boş olan en sona', () => {
    const route = buildPickupRoute([
      g({ vendorId: 'bos', city: null, totalQuantity: 100 }),
      g({ vendorId: 'dolu', city: 'Adana', totalQuantity: 1 }),
    ]);
    expect(route[0]!.vendorId).toBe('dolu');
    expect(route[1]!.vendorId).toBe('bos');
  });

  it('deterministik: aynı girdi aynı çıktı, seq 1..n', () => {
    const input = [
      g({ vendorId: 'X', city: 'İstanbul', district: 'Kadıköy', totalQuantity: 3 }),
      g({ vendorId: 'Y', city: 'İstanbul', district: 'Beşiktaş', totalQuantity: 3 }),
    ];
    const r1 = buildPickupRoute(input);
    const r2 = buildPickupRoute(input);
    expect(r1).toEqual(r2);
    expect(r1.map((r) => r.seq)).toEqual([1, 2]);
    // Beşiktaş < Kadıköy (ilçe alfabetik)
    expect(r1[0]!.district).toBe('Beşiktaş');
  });

  it('boş liste → boş rota', () => {
    expect(buildPickupRoute([])).toEqual([]);
  });
});
