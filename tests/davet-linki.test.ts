/**
 * #992317 · DAVET LİNKİ ÇİVİSİ — Mehmet'in 30 Eyl kuralının kodda tuttuğunu ölçer.
 * Kural: link 24 saat geçerli · parola oluşunca link ölür (tek kullanım) ·
 *        ham token DB'de tutulmaz · "yok/süresi geçmiş/kullanılmış" AYNI yanıtı döner.
 * Saf mantık testi — DB'ye BAĞLANMAZ, gerçek token/kullanıcı ÜRETMEZ.
 */
import { describe, expect, it } from 'vitest';
import {
  DAVET_OMRU_MS,
  DAVET_OMRU_SAAT,
  davetHukmu,
  davetTuketilebilirMi,
  davetTokenUret,
  tokenOzeti,
} from '@/lib/davet';

const T0 = new Date('2026-09-30T12:00:00.000Z');

describe('davet linki — süre', () => {
  it('ömür 24 saattir (koda gömülü sayı değil, tek sabit)', () => {
    expect(DAVET_OMRU_SAAT).toBe(24);
    expect(DAVET_OMRU_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('üretilen token tam 24 saat sonra dolar', () => {
    const { expiresAt } = davetTokenUret(T0);
    expect(expiresAt.getTime() - T0.getTime()).toBe(DAVET_OMRU_MS);
  });

  it('23:59:59te GEÇERLİ, 24:00:01de GEÇERSİZ', () => {
    const k = { expiresAt: new Date(T0.getTime() + DAVET_OMRU_MS), usedAt: null };
    expect(davetHukmu(k, new Date(T0.getTime() + DAVET_OMRU_MS - 1000))).toBe('gecerli');
    expect(davetHukmu(k, new Date(T0.getTime() + DAVET_OMRU_MS + 1000))).toBe('gecersiz');
  });

  it('tam sınırda (=) GEÇERSİZ — sınır kapalıdır, bir saniye bile fazla yaşamaz', () => {
    const k = { expiresAt: new Date(T0.getTime() + DAVET_OMRU_MS), usedAt: null };
    expect(davetHukmu(k, new Date(T0.getTime() + DAVET_OMRU_MS))).toBe('gecersiz');
  });
});

describe('davet linki — tek kullanım', () => {
  it('usedAt damgalıysa link ÖLÜR (süresi dolmamış olsa bile)', () => {
    const k = { expiresAt: new Date(T0.getTime() + DAVET_OMRU_MS), usedAt: new Date(T0) };
    expect(davetHukmu(k, T0)).toBe('gecersiz');
    expect(davetTuketilebilirMi(k, T0)).toBe(false);
  });

  it('kullanılmamış ve süresi dolmamış token tüketilebilir', () => {
    const k = { expiresAt: new Date(T0.getTime() + DAVET_OMRU_MS), usedAt: null };
    expect(davetTuketilebilirMi(k, T0)).toBe(true);
  });
});

describe('davet linki — bilgi sızdırmama (NEGATİF ÇİVİ)', () => {
  it('yok · süresi geçmiş · kullanılmış → ÜÇÜ DE aynı yanıtı döner', () => {
    const yok = davetHukmu(null, T0);
    const suresiGecmis = davetHukmu(
      { expiresAt: new Date(T0.getTime() - 1000), usedAt: null }, T0);
    const kullanilmis = davetHukmu(
      { expiresAt: new Date(T0.getTime() + DAVET_OMRU_MS), usedAt: new Date(T0) }, T0);
    expect(yok).toBe('gecersiz');
    expect(suresiGecmis).toBe('gecersiz');
    expect(kullanilmis).toBe('gecersiz');
    // Üçü BİRBİRİNDEN ayırt edilemez olmalı — ayrılırsa token uzayı taranabilir.
    expect(new Set([yok, suresiGecmis, kullanilmis]).size).toBe(1);
  });

  it('undefined kayıt da geçersizdir (çağıran kontrolü unutursa sessizce açılmaz)', () => {
    expect(davetHukmu(undefined, T0)).toBe('gecersiz');
  });
});

describe('davet linki — token gizliliği', () => {
  it('ham token DB özetinden FARKLIDIR ve özet 64 haneli sha256tir', () => {
    const { ham, ozet } = davetTokenUret(T0);
    expect(ozet).not.toBe(ham);
    expect(ozet).toMatch(/^[0-9a-f]{64}$/);
  });

  it('özet deterministiktir — aynı ham token aynı özeti verir', () => {
    const { ham, ozet } = davetTokenUret(T0);
    expect(tokenOzeti(ham)).toBe(ozet);
  });

  it('iki ayrı üretim ASLA aynı token vermez (entropi gerçekten var)', () => {
    const a = davetTokenUret(T0);
    const b = davetTokenUret(T0);
    expect(a.ham).not.toBe(b.ham);
    expect(a.ozet).not.toBe(b.ozet);
    expect(a.ham.length).toBeGreaterThanOrEqual(43); // 32 bayt base64url
  });
});
