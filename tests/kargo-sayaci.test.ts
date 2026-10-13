/**
 * ÇİVİ — aynı gün kargo geri sayımı (Yunus, 13 Eki 2026).
 *
 * YÖNTEM: kopya kod ÜZERİNDE değil, YAYINA GİDECEK yama metninin İÇİNDEKİ karar
 * fonksiyonu çıkarılıp koşturulur (kampanya-modal-gecikme.test.ts ile aynı desen).
 * Böylece yama değişince çivi de onunla birlikte ölçer.
 *
 * KRİTİK İDDİA: Cumartesi 13:00 sonrası ve Pazar boyunca "bugün kargoda" sözü
 * ASLA verilmez — müşteriye yanlış teslim sözü vermek geri alınamaz bir hatadır.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const YAMA = join(__dirname, '..', 'tema-yamalari', 'via-kargo-sayaci.liquid.YENI');
const kaynak = readFileSync(YAMA, 'utf8');

/** Yamanın içindeki saf karar bloğunu çıkarır ve çalıştırılabilir hâle getirir. */
function kararFn(): (ms: number) => { kalan: number; bugun: boolean; etiket: string } {
  const bas = kaynak.indexOf('var KESIM');
  const son = kaynak.indexOf('function sureYaz');
  expect(bas).toBeGreaterThan(-1);
  expect(son).toBeGreaterThan(bas);
  return new Function(kaynak.slice(bas, son) + '; return vksDurum;')() as never;
}
const vksDurum = kararFn();

/** Test tarihlerinin gerçekten o güne denk geldiğini DOĞRULAR (kendi aritmetiğime güvenmiyorum). */
const trGun = (ms: number) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(new Date(ms));
/** TR = UTC+3 (2016'dan beri yaz saati yok). */
const tr = (y: number, ay: number, g: number, sa: number, dk = 0) => Date.UTC(y, ay - 1, g, sa - 3, dk, 0);

describe('kesim saati kararı', () => {
  it('Çarşamba 13:48 → bugün kargoda, 1 sa 12 dk kaldı', () => {
    const t = tr(2026, 10, 14, 13, 48);
    expect(trGun(t)).toBe('Wed');
    const d = vksDurum(t);
    expect(d.bugun).toBe(true);
    expect(d.etiket).toBe('bugün kargoda');
    expect(d.kalan).toBe(72 * 60);
  });

  it('Çarşamba 14:30 → son 1 saat eşiğinin ALTINDA (acil durum tetiklenmeli)', () => {
    const d = vksDurum(tr(2026, 10, 14, 14, 30));
    expect(d.bugun && d.kalan < 3600).toBe(true);
  });

  it('Çarşamba 13:48 → acil DEĞİL (negatif ayak: eşik gevşek olmamalı)', () => {
    const d = vksDurum(tr(2026, 10, 14, 13, 48));
    expect(d.bugun && d.kalan < 3600).toBe(false);
  });

  it('Çarşamba 15:22 → kesim kaçtı, Perşembe kargoda', () => {
    const d = vksDurum(tr(2026, 10, 14, 15, 22));
    expect(d.bugun).toBe(false);
    expect(d.etiket).toBe('Perşembe kargoda');
  });

  it('Cumartesi kesimi 13:00 (15:00 DEĞİL)', () => {
    const t = tr(2026, 10, 17, 12, 0);
    expect(trGun(t)).toBe('Sat');
    const d = vksDurum(t);
    expect(d.bugun).toBe(true);
    expect(d.kalan).toBe(3600);
  });

  it('Cuma 16:00 → Cumartesi kargoda (hafta sonu atlanmaz)', () => {
    const t = tr(2026, 10, 16, 16, 0);
    expect(trGun(t)).toBe('Fri');
    expect(vksDurum(t).etiket).toBe('Cumartesi kargoda');
  });
});

describe('KIRMIZI ÇİZGİ — yanlış "bugün" sözü verilmemeli', () => {
  it('Cumartesi 13:30 → Pazartesi kargoda, Pazar ATLANIR', () => {
    const d = vksDurum(tr(2026, 10, 17, 13, 30));
    expect(d.bugun).toBe(false);
    expect(d.etiket).toBe('Pazartesi kargoda');
    // Cmt 13:30 → Pzt 15:00 = 10.5 sa + 24 sa + 15 sa
    expect(d.kalan).toBe((10 * 3600 + 30 * 60) + 86400 + 15 * 3600);
  });

  it('Pazar 10:00 → Pazartesi kargoda', () => {
    const t = tr(2026, 10, 18, 10, 0);
    expect(trGun(t)).toBe('Sun');
    const d = vksDurum(t);
    expect(d.bugun).toBe(false);
    expect(d.etiket).toBe('Pazartesi kargoda');
  });

  it('Pazar ve Cmt-sonrası HİÇBİR saatte "bugün" geçmez', () => {
    for (const sa of [0, 6, 13, 14, 18, 23]) {
      expect(vksDurum(tr(2026, 10, 18, sa)).etiket).not.toContain('bugün');  // Pazar
    }
    for (const sa of [13, 15, 20, 23]) {
      expect(vksDurum(tr(2026, 10, 17, sa)).etiket).not.toContain('bugün');  // Cmt kesim sonrası
    }
  });
});

describe('saat kaynağı sunucudur', () => {
  it('istemci saati değil, sunucu damgası esas alınıyor', () => {
    expect(kaynak).toContain("data-sunucu-ts=\"{{ 'now' | date: '%s' }}\"");
    expect(kaynak).toContain("(parseInt(kok.getAttribute('data-sunucu-ts'),10) * 1000) - Date.now()");
    expect(kaynak).toContain('vksDurum(Date.now() + fark)');
  });
  it('kesim hesabı İstanbul saat diliminde yapılıyor', () => {
    expect(kaynak).toContain("timeZone:'Europe/Istanbul'");
  });
});
