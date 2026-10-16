/**
 * ÇİVİ — #994057 A2: hoş geldin hatırlatması, kod KULLANILDIYSA gitmez.
 *
 * Yunus'un 16 Eki spec'i birebir: "+2 gün E-posta 2 … SADECE kodu kullanmadıysa
 * gönder". ÖLÇÜLEN AÇIK: A2 KUPONSUZ bir adım, bu yüzden `kuponluAdimMi()`
 * kapısına hiç girmiyordu ve kupon durumu SORULMUYORDU — müşteri kodu kullanmış
 * olsa bile hatırlatma çıkıyordu.
 */
import { describe, expect, it, vi } from 'vitest';
import { AKIS, hatirlatmaAtlanirMi } from '@/lib/eposta-akis';

vi.mock('@/lib/env', () => ({ env: { STOREFRONT_URL: 'https://viamood.com.tr', MAIL_FROM: 'a@b.c' } }));
vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/lib/email/sender', () => ({
  mailKanaliHazir: () => true,
  sendEmail: vi.fn(async () => ({ ok: true })),
}));

describe('A2 — saf kural', () => {
  it('yalnız HOŞ GELDİN akışının 2. adımı kupon durumuna BAKAR', () => {
    expect(hatirlatmaAtlanirMi(AKIS.HOS_GELDIN, 2)).toBe(true);
  });

  it('NEGATİF: hoş geldin 1. adım (kod teslimi) bu kapıya GİRMEZ', () => {
    expect(hatirlatmaAtlanirMi(AKIS.HOS_GELDIN, 1)).toBe(false);
  });

  it('NEGATİF: sepet terki ve checkout terki adımları ETKİLENMEZ', () => {
    for (const adim of [1, 2, 3]) {
      expect(hatirlatmaAtlanirMi(AKIS.SEPET_TERKI, adim)).toBe(false);
      expect(hatirlatmaAtlanirMi(AKIS.CHECKOUT_TERKI, adim)).toBe(false);
    }
  });
});

describe('A2 — gönderim katmanı kuralı gerçekten uyguluyor', () => {
  it('kaynak: kupon kapısından ÖNCE kod kullanımını soruyor', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/lib/eposta-akis-gonderim.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const iHatirlatma = src.indexOf('hatirlatmaAtlanirMi(');
    const iKupon = src.indexOf('kuponluAdimMi(akis, s.adim)');
    expect(iHatirlatma).toBeGreaterThan(-1);
    expect(iKupon).toBeGreaterThan(-1);
    expect(iHatirlatma).toBeLessThan(iKupon);        // sıra: önce A2 kapısı
    expect(src).toContain('kuponKullanildiMi(db, tetik.email, akis)');
    expect(src).toContain("'kod_kullanildi'");       // ölçülebilir atlama sebebi
  });

  it('NEGATİF: kural kaldırılırsa kaynakta hiçbir kod-kullanım sorgusu kalmaz', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/lib/eposta-akis-gonderim.ts', import.meta.url), 'utf8');
    // İki ayak birlikte olmalı: çağrı + atlama işaretlemesi
    const cagri = src.includes('kuponKullanildiMi');
    const isaret = src.includes('kod kullanıldı');
    expect(cagri && isaret).toBe(true);
  });
});
