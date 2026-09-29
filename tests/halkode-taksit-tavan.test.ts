import { describe, it, expect } from 'vitest';
import { MAKS_TAKSIT, taksitGecerli } from '@/lib/halkode/taksit-tavan';

/**
 * Yunus, 29 Eyl 2026 (acil): kart formunda 12 taksit satırı birden çıkıyordu.
 * Kök sebep ölçüldü: HalkÖde POS tanımı 12 seçeneğin HEPSİNİ vade farksız döndürüyor,
 * bizde ise yalnız "vade farksız" süzgeci vardı, taksit SAYISI tavanı yoktu.
 */
describe('halkode taksit tavanı', () => {
  it('tavan 3', () => expect(MAKS_TAKSIT).toBe(3));

  it('API 12 seçenek döndürünce liste 3 satırda kalır', () => {
    const apiden = Array.from({ length: 12 }, (_, k) => ({
      installments_number: k + 1,
      amount_to_be_paid: '1000.00',
    }));
    const gosterilen = apiden.filter((i) => taksitGecerli(i.installments_number));
    expect(gosterilen).toHaveLength(3);
    expect(gosterilen.map((i) => i.installments_number)).toEqual([1, 2, 3]);
    // 4+ hiç kalmamalı — Yunus'un ekranındaki 12 satır bir daha çıkmasın
    expect(gosterilen.filter((i) => i.installments_number > 3)).toHaveLength(0);
  });

  it('API 2 ve 3ü döndürmüyorsa biz de göstermeyiz — süzgeç DARALTIR, üretmez', () => {
    const apiden = [{ installments_number: 1, amount_to_be_paid: '1000.00' }];
    expect(apiden.filter((i) => taksitGecerli(i.installments_number))).toHaveLength(1);
  });

  it('initialize kapısı: 12 reddedilir, 1..3 kabul', () => {
    expect(taksitGecerli(12)).toBe(false);
    expect(taksitGecerli(4)).toBe(false);
    for (const n of [1, 2, 3]) expect(taksitGecerli(n)).toBe(true);
  });

  it('bozuk/eksik değerler tek çekim sayılır, tavanı aşamaz', () => {
    expect(taksitGecerli(undefined)).toBe(true); // Number(undefined)||1 → 1
    expect(taksitGecerli('2')).toBe(true);
    expect(taksitGecerli('12')).toBe(false);
    expect(taksitGecerli(0)).toBe(true); // 0||1 → 1
    expect(taksitGecerli(-5)).toBe(false);
  });
});
