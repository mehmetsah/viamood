/**
 * FAZ 4a — Reklam önerisi skorlama (DB katmanı). Saf çekirdek: `scoring-core.ts`.
 *
 * Kilitli kararlar:
 *  - Payda N = o anki oy-hakkı olan kullanıcı sayısı (DİNAMİK, snapshot değil).
 *    Şimdilik = admin + super_admin. İleride ayrı "reklam" rolü ile daraltılır.
 *  - Skor = olumlu oy ORANI (%); N/N tamamlanınca >= %60 → onaylı.
 */
import { count, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { adSuggestionVotes, users } from '@/db/schema';
import { computeScore, type SuggestionScore } from './scoring-core';

// Saf çekirdeği aynı yol üzerinden de kullanılabilsin (geri uyum).
export { APPROVAL_THRESHOLD_PCT, computeScore, type SuggestionScore } from './scoring-core';

/** Oy hakkı olan roller (dinamik N buradan sayılır). */
export const VOTER_ROLES = ['admin', 'super_admin'] as const;

/** Dinamik N — şu anda oy hakkı olan kullanıcı sayısı. */
export async function countEligibleVoters(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(inArray(users.role, [...VOTER_ROLES]));
  return row?.n ?? 0;
}

/** Bir önerinin canlı skorunu hesaplar (oylardan + dinamik N'den). */
export async function getSuggestionScore(suggestionId: string): Promise<SuggestionScore> {
  const votes = await db
    .select({ vote: adSuggestionVotes.vote })
    .from(adSuggestionVotes)
    .where(eq(adSuggestionVotes.suggestionId, suggestionId));

  const yes = votes.filter((v) => v.vote === 'yes').length;
  const no = votes.filter((v) => v.vote === 'no').length;
  const eligibleVoters = await countEligibleVoters();

  return computeScore(yes, no, eligibleVoters);
}
