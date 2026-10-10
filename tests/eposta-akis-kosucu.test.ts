/**
 * #992966 madde 3 — AKIŞ KOŞUCUSU çivisi.
 *
 * Kapsam BİLEREK dar: plan üretimi · vakti gelme sınırı · iptal seçimi ·
 * durum sözlüğü · "mail göndermeme" güvencesi.
 * ⚠ GERÇEK MAİL GÖNDERMEZ, GERÇEK DB'YE DOKUNMAZ — db sahte nesneyle verilir.
 * Her iddianın NEGATİF bacağı var: kural kalkarsa test KIRILMALI.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AKIS, ADIMLAR } from '@/lib/eposta-akis';
import {
  DURUM,
  akisBaslat,
  iptalEdilecekler,
  planSatirlari,
  vaktiGeldiMi,
} from '@/lib/eposta-akis-kosucu';

const KAYNAK = readFileSync('src/lib/eposta-akis-kosucu.ts', 'utf8');
const T0 = new Date('2026-10-10T12:00:00Z');

describe('plan üretimi', () => {
  it('her akış için ADIMLAR kadar satır üretir', () => {
    for (const akis of Object.values(AKIS)) {
      const s = planSatirlari({ akis, tetikAni: T0, iysOnayi: false });
      expect(s.length).toBe(ADIMLAR[akis].length);
      expect(new Set(s.map((x) => x.adim)).size).toBe(s.length); // adım TEKRARLAMAZ
    }
  });

  it('tüm satırlar "planlandi" doğar', () => {
    const s = planSatirlari({ akis: AKIS.SEPET_TERKI, tetikAni: T0, iysOnayi: false });
    expect(s.every((x) => x.durum === DURUM.PLANLANDI)).toBe(true);
  });

  it('İYS onayı YOKSA sms adımı e-postaya düşer (adım ATLANMAZ)', () => {
    const smsli = Object.values(AKIS).find((a) => ADIMLAR[a].some((x) => x.sms));
    if (!smsli) return;                       // akışlarda sms adımı yoksa iddia boş
    const kapali = planSatirlari({ akis: smsli, tetikAni: T0, iysOnayi: false });
    const acik = planSatirlari({ akis: smsli, tetikAni: T0, iysOnayi: true });
    expect(kapali.length).toBe(acik.length);  // ← ATLANMAZ
    expect(kapali.every((x) => x.kanal === 'eposta')).toBe(true);
    expect(acik.some((x) => x.kanal === 'sms')).toBe(true);   // NEGATİF: onaylıyken fark OLMALI
  });

  it('planlanan anlar tetik anından GERİYE gitmez ve artan sırada', () => {
    const s = planSatirlari({ akis: AKIS.SEPET_TERKI, tetikAni: T0, iysOnayi: false });
    const t = s.map((x) => x.planlananAn.getTime());
    expect(Math.min(...t)).toBeGreaterThanOrEqual(T0.getTime());
    expect([...t].sort((a, b) => a - b)).toEqual(t);
  });
});

describe('vakti gelme sınırı', () => {
  const satir = { durum: DURUM.PLANLANDI, planlananAn: T0 };
  it('tam sınırda GELİR (<=)', () => expect(vaktiGeldiMi(satir, T0)).toBe(true));
  it('1 ms önce GELMEZ', () => expect(vaktiGeldiMi(satir, new Date(T0.getTime() - 1))).toBe(false));
  it('NEGATİF: planlandi olmayan satır vakti gelse de GELMEZ', () => {
    expect(vaktiGeldiMi({ durum: DURUM.GONDERILDI, planlananAn: T0 }, T0)).toBe(false);
  });
});

describe('iptal seçimi', () => {
  it('yalnız planlandi olanlar iptale düşer', () => {
    const hepsi = [
      { id: 'a', durum: DURUM.PLANLANDI },
      { id: 'b', durum: DURUM.GONDERILDI },
      { id: 'c', durum: DURUM.HATA },
      { id: 'd', durum: DURUM.PLANLANDI },
    ];
    expect(iptalEdilecekler(hepsi).map((x) => x.id)).toEqual(['a', 'd']);
  });
  it('NEGATİF: gönderilmiş adım ASLA iptale düşmez (defter yalan söylemez)', () => {
    expect(iptalEdilecekler([{ id: 'x', durum: DURUM.GONDERILDI }])).toHaveLength(0);
  });
});

describe('akisBaslat — tek işlem, yarım plan yok', () => {
  it('tetik + TÜM adımlar aynı transaction içinde yazılır', async () => {
    const yazilan: Record<string, unknown[]> = { tetik: [], gonderim: [] };
    const tx = {
      insert: (tablo: any) => ({
        values: (v: any) => {
          const ad = String(tablo[Symbol.for('drizzle:Name')] ?? '').includes('tetik') ? 'tetik' : 'gonderim';
          yazilan[ad].push(v);
          return { returning: async () => [{ id: 'tetik-1' }] };
        },
      }),
    };
    const db = { transaction: async (fn: any) => fn(tx) } as any;
    const r = await akisBaslat(db, { akis: AKIS.SEPET_TERKI, email: 'a@b.c', tetikAni: T0 });
    expect(r.tetikId).toBe('tetik-1');
    expect(r.satir).toBe(ADIMLAR[AKIS.SEPET_TERKI].length);
    expect(yazilan.gonderim).toHaveLength(1);                 // TEK toplu insert
    expect((yazilan.gonderim[0] as unknown[]).length).toBe(r.satir);
  });
});

describe('güvence — bu katman MAİL GÖNDERMEZ', () => {
  it('kaynakta gönderim çağrısı YOK', () => {
    expect(/sendEmail|nodemailer|resend|fetch\(/i.test(KAYNAK)).toBe(false);
  });
  it('durum sözlüğü serbest metin DEĞİL (tek kaynak DURUM)', () => {
    expect(KAYNAK).toContain("PLANLANDI: 'planlandi'");
    expect(/durum:\s*'gonderildi'/.test(KAYNAK)).toBe(false);  // ham dizi yazılmamış
  });
});
