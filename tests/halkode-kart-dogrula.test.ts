/**
 * Halköde initialize kart şekil denetimi (21 Eyl 2026).
 * Şekil hatası taslak sipariş AÇILMADAN reddedilmeli; dönen mesaj kart verisi taşımamalı.
 */
import { describe, it, expect } from 'vitest';
import { kartDenetle } from '@/lib/halkode/kart-dogrula';

const SIMDI = new Date('2026-09-21T12:00:00+03:00');
// QNB test visa (Luhn geçerli) — docs'taki çalışan test kartı; gerçek kart DEĞİL.
const GECERLI = { cc_no: '4155 6501 0041 6111', expiry_month: '12', expiry_year: '2028', cvv: '000' };

describe('kartDenetle', () => {
  it('geçerli şekli kabul eder ve normalleştirir', () => {
    const r = kartDenetle(GECERLI, SIMDI);
    expect(r).toEqual({ ok: true, ccNo: '4155650100416111', ay: '12', yil: '2028', cvv: '000' });
  });

  it('iki haneli yılı ve tek haneli ayı tamamlar', () => {
    const r = kartDenetle({ ...GECERLI, expiry_month: '5', expiry_year: '28' }, SIMDI);
    expect(r.ok && r.ay).toBe('05');
    expect(r.ok && r.yil).toBe('2028');
  });

  it('Luhn tutmayan numarayı reddeder', () => {
    const r = kartDenetle({ ...GECERLI, cc_no: '4155650100416112' }, SIMDI);
    expect(r).toMatchObject({ ok: false, alan: 'cc_no' });
  });

  it('kısa / uzun numarayı reddeder', () => {
    expect(kartDenetle({ ...GECERLI, cc_no: '4111111' }, SIMDI).ok).toBe(false);
    expect(kartDenetle({ ...GECERLI, cc_no: '4'.repeat(20) }, SIMDI).ok).toBe(false);
  });

  it('geçmiş son kullanmayı reddeder, bu ayı kabul eder', () => {
    expect(kartDenetle({ ...GECERLI, expiry_month: '08', expiry_year: '2026' }, SIMDI)).toMatchObject({ ok: false, alan: 'expiry' });
    expect(kartDenetle({ ...GECERLI, expiry_month: '09', expiry_year: '2026' }, SIMDI).ok).toBe(true);
    expect(kartDenetle({ ...GECERLI, expiry_month: '13', expiry_year: '2028' }, SIMDI).ok).toBe(false);
    expect(kartDenetle({ ...GECERLI, expiry_month: '', expiry_year: '2028' }, SIMDI).ok).toBe(false);
  });

  it('CVV uzunluğunu denetler', () => {
    expect(kartDenetle({ ...GECERLI, cvv: '12' }, SIMDI)).toMatchObject({ ok: false, alan: 'cvv' });
    expect(kartDenetle({ ...GECERLI, cvv: '1234' }, SIMDI).ok).toBe(true);
  });

  it('red mesajı kart verisi İÇERMEZ', () => {
    for (const k of [
      { ...GECERLI, cc_no: '4155650100416112' },
      { ...GECERLI, expiry_year: '2020' },
      { ...GECERLI, cvv: '9' },
    ]) {
      const r = kartDenetle(k, SIMDI);
      expect(r.ok).toBe(false);
      const metin = JSON.stringify(r);
      expect(metin).not.toMatch(/415565/);
      expect(metin).not.toContain(k.cvv);
    }
  });
});
