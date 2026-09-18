/**
 * FAZ 4a — Reklam önerisi skorlama ÇEKİRDEĞİ (SAF, DB'siz, test edilebilir).
 * DB erişimi `scoring.ts`'te; iş kuralı burada izole.
 */

/** Onay eşiği (%). >= bu değer → reklama uygun. */
export const APPROVAL_THRESHOLD_PCT = 60;

export interface SuggestionScore {
  /** N — o anki oy hakkı olan kullanıcı sayısı (dinamik). */
  eligibleVoters: number;
  /** x — verilen oy sayısı. */
  voted: number;
  yes: number;
  no: number;
  /** Olumlu oranı %. Henüz oy yoksa null. */
  scorePct: number | null;
  /** Tüm oy hakkı sahipleri oy verdi mi (x >= N). */
  complete: boolean;
  /** complete ise scorePct >= eşik; değilse null (henüz kesinleşmedi). */
  approved: boolean | null;
  thresholdPct: number;
}

/**
 * SAF hesap — yes/no oy sayısı + dinamik N → skor, tamamlanma, onay.
 * Kilitli kural: skor = olumlu oranı %; N/N tamamlanınca >=%60 → onaylı.
 */
export function computeScore(yes: number, no: number, eligibleVoters: number): SuggestionScore {
  const voted = yes + no;
  const scorePct = voted > 0 ? Math.round((yes / voted) * 100) : null;
  const complete = eligibleVoters > 0 && voted >= eligibleVoters;
  const approved =
    complete && scorePct != null ? scorePct >= APPROVAL_THRESHOLD_PCT : null;
  return {
    eligibleVoters,
    voted,
    yes,
    no,
    scorePct,
    complete,
    approved,
    thresholdPct: APPROVAL_THRESHOLD_PCT,
  };
}
