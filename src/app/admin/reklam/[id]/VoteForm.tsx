'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@/lib/actions/auth';

interface Props {
  suggestionId: string;
  currentVote: 'yes' | 'no' | null;
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}

export function VoteForm({ suggestionId, currentVote, action }: Props) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="suggestionId" value={suggestionId} />
      <textarea
        name="comment"
        rows={2}
        placeholder="Açıklama (opsiyonel) — neden evet/hayır?"
        className="w-full px-4 py-2 rounded-lg border border-neutral-300 text-[15px] outline-none focus:border-[var(--color-brand-orange)] focus:ring-2 focus:ring-[var(--color-brand-orange)]/20"
      />
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          name="vote"
          value="yes"
          disabled={pending}
          className={`h-11 px-6 rounded-full font-semibold border-2 transition disabled:opacity-50 ${
            currentVote === 'yes'
              ? 'bg-green-600 text-white border-green-600'
              : 'border-green-600 text-green-700 hover:bg-green-50'
          }`}
        >
          Evet
        </button>
        <button
          type="submit"
          name="vote"
          value="no"
          disabled={pending}
          className={`h-11 px-6 rounded-full font-semibold border-2 transition disabled:opacity-50 ${
            currentVote === 'no'
              ? 'bg-red-600 text-white border-red-600'
              : 'border-red-500 text-red-600 hover:bg-red-50'
          }`}
        >
          Hayır
        </button>
        {currentVote && (
          <span className="text-sm text-neutral-500">
            Mevcut oyun: <strong>{currentVote === 'yes' ? 'Evet' : 'Hayır'}</strong> (değiştirebilirsin)
          </span>
        )}
      </div>
      {state?.success && <span className="text-sm text-green-700">✓ Oyun kaydedildi</span>}
      {state && !state.success && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
