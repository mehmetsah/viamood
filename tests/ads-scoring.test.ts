import { describe, expect, it } from 'vitest';
import { APPROVAL_THRESHOLD_PCT, computeScore } from '@/lib/ads/scoring-core';

describe('reklam önerisi skorlama (computeScore)', () => {
  it('eşik %60', () => {
    expect(APPROVAL_THRESHOLD_PCT).toBe(60);
  });

  it('hiç oy yok → skor null, tamamlanmadı, onay null', () => {
    const s = computeScore(0, 0, 5);
    expect(s.voted).toBe(0);
    expect(s.scorePct).toBeNull();
    expect(s.complete).toBe(false);
    expect(s.approved).toBeNull();
  });

  it('kısmi oy (3/5) → canlı %100 ama henüz kesinleşmedi', () => {
    const s = computeScore(3, 0, 5);
    expect(s.voted).toBe(3);
    expect(s.scorePct).toBe(100);
    expect(s.complete).toBe(false);
    expect(s.approved).toBeNull(); // N/N değil → karar yok
  });

  it('N/N tamamlandı, hepsi evet → onaylı', () => {
    const s = computeScore(5, 0, 5);
    expect(s.complete).toBe(true);
    expect(s.scorePct).toBe(100);
    expect(s.approved).toBe(true);
  });

  it('4 evet 1 hayır (5 kişi) → %80 → onaylı', () => {
    const s = computeScore(4, 1, 5);
    expect(s.scorePct).toBe(80);
    expect(s.complete).toBe(true);
    expect(s.approved).toBe(true);
  });

  it('tam %60 sınırı (3 evet 2 hayır) → onaylı (>= eşik)', () => {
    const s = computeScore(3, 2, 5);
    expect(s.scorePct).toBe(60);
    expect(s.approved).toBe(true);
  });

  it('%60 altı (2 evet 3 hayır = %40) → onaysız', () => {
    const s = computeScore(2, 3, 5);
    expect(s.scorePct).toBe(40);
    expect(s.complete).toBe(true);
    expect(s.approved).toBe(false);
  });

  it('%59 (59/100) → onaysız (sınır altı)', () => {
    const s = computeScore(59, 41, 100);
    expect(s.scorePct).toBe(59);
    expect(s.approved).toBe(false);
  });

  it('dinamik N büyürse: 5 oy ama N=6 → henüz tamamlanmadı', () => {
    const s = computeScore(5, 0, 6);
    expect(s.scorePct).toBe(100);
    expect(s.complete).toBe(false);
    expect(s.approved).toBeNull();
  });

  it('tek admin (öneren oto-evet) → 1/1 → anında onaylı', () => {
    const s = computeScore(1, 0, 1);
    expect(s.complete).toBe(true);
    expect(s.scorePct).toBe(100);
    expect(s.approved).toBe(true);
  });

  it('oy hakkı olan yok (N=0) → asla tamamlanmaz', () => {
    const s = computeScore(0, 0, 0);
    expect(s.complete).toBe(false);
    expect(s.approved).toBeNull();
  });

  it('yuvarlama: 2 evet 1 hayır → %67', () => {
    const s = computeScore(2, 1, 3);
    expect(s.scorePct).toBe(67); // 66.67 → 67
    expect(s.approved).toBe(true);
  });
});
