/**
 * #615 — PTT etiketinde il "TR-04" basılması.
 *
 * ARKA PLAN: Ödeme formu il alanında bazen ADI değil KODU gönderiyor.
 * `provinceCode('TR-34')` tabloda isim arıyordu, bulamayıp null dönüyordu ve
 * Shopify'a `province: 'TR-34'` gidiyordu → KargoLab/PTT etiketine il kod olarak
 * basılıyordu. 15 Eyl 2026 canlı ölçümü: son 40 siparişin 24'ünde il TR-XX kalmış
 * (#1158 TR-34, #1156 TR-48, #1155 TR-35 …).
 */
import { describe, expect, it } from 'vitest';
import { provinceCode, provinceName } from '@/lib/shopify/tr-provinces';

describe('provinceName — il değerini kanonik ada çevirir', () => {
  it('KOD gelirse ada çevirir (asıl arıza)', () => {
    expect(provinceName('TR-34')).toBe('İstanbul');
    expect(provinceName('TR-04')).toBe('Ağrı');
    expect(provinceName('TR-48')).toBe('Muğla');
    expect(provinceName('tr-35')).toBe('İzmir'); // küçük harfli kod da olur
  });

  it('AD gelirse kanonik yazıma oturur', () => {
    expect(provinceName('istanbul')).toBe('İstanbul');
    expect(provinceName('  MUĞLA  ')).toBe('Muğla');
    expect(provinceName('ağrı')).toBe('Ağrı');
  });

  it('noktasız I ile yazılan iller doğru', () => {
    // Otomatik büyük harfe çevirme bunları "İsparta"/"İğdır" yapıyor — yanlış.
    expect(provinceName('TR-32')).toBe('Isparta');
    expect(provinceName('TR-76')).toBe('Iğdır');
  });

  it('tanınmayan değeri KAYBETMEZ, aynen döndürür', () => {
    expect(provinceName('Bilinmeyen İl')).toBe('Bilinmeyen İl');
    expect(provinceName('TR-99')).toBe('TR-99'); // geçersiz kod
    expect(provinceName('')).toBe('');
    expect(provinceName(undefined)).toBe('');
  });
});

describe('provinceCode — kod üretimi', () => {
  it('ad → kod (mevcut davranış korunuyor)', () => {
    expect(provinceCode('İstanbul')).toBe('TR-34');
    expect(provinceCode('ağrı')).toBe('TR-04');
    expect(provinceCode('Mersin')).toBe('TR-33');
  });

  it('zaten KOD verilirse kendisini döner (eskiden null dönüyordu)', () => {
    expect(provinceCode('TR-34')).toBe('TR-34');
    expect(provinceCode('tr-04')).toBe('TR-04');
  });

  it('geçersiz kodu kabul etmez', () => {
    expect(provinceCode('TR-99')).toBeNull();
    expect(provinceCode('Bilinmeyen')).toBeNull();
    expect(provinceCode(undefined)).toBeNull();
  });

  it('provinceName → provinceCode zinciri kod girdisinde de çalışır', () => {
    // Uçlardaki yeni akış: provinceName(gelen) → provinceCode(il)
    for (const gelen of ['TR-34', 'istanbul', 'İSTANBUL']) {
      const il = provinceName(gelen);
      expect(il).toBe('İstanbul');
      expect(provinceCode(il)).toBe('TR-34');
    }
  });
});
