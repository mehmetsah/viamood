'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import type { ActionResult } from '@/lib/actions/auth';

interface Props {
  suggestionId: string;
  influencers: { id: string; handle: string; displayName: string | null }[];
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}

export function AddInfluencerForm({ suggestionId, influencers, action }: Props) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);

  return (
    <form action={formAction} className="flex items-center gap-2 flex-wrap">
      <input type="hidden" name="suggestionId" value={suggestionId} />
      <select
        name="influencerId"
        required
        defaultValue=""
        className="h-11 px-4 rounded-lg border border-neutral-300 bg-white text-[15px] outline-none focus:border-[var(--color-brand-orange)]"
      >
        <option value="" disabled>— Influencer seç —</option>
        {influencers.map((i) => (
          <option key={i.id} value={i.id}>
            @{i.handle}{i.displayName ? ` (${i.displayName})` : ''}
          </option>
        ))}
      </select>
      <Button type="submit" loading={pending} size="sm">Ekle</Button>
      {state && !state.success && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
