'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { ActionResult } from '@/lib/actions/auth';

interface Props {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}

export function NewInfluencerForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const [open, setOpen] = useState(false);
  const fieldErrors = state && !state.success ? state.fieldErrors ?? {} : {};

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="lg">
        + Yeni influencer
      </Button>
    );
  }

  return (
    <form action={formAction} className="bg-white border rounded-xl p-6 flex flex-col gap-4 max-w-2xl">
      <h2 className="font-bold border-b pb-2">Yeni influencer</h2>
      <div className="grid grid-cols-2 gap-4">
        <Input name="handle" label="Kullanıcı adı (@)" required placeholder="viamood" error={fieldErrors.handle} />
        <Input name="followerCount" label="Takipçi (elle)" type="number" min="0" placeholder="50000" />
      </div>
      <Input
        name="instagramUrl"
        label="Instagram profil linki"
        required
        placeholder="https://instagram.com/kullanici"
        error={fieldErrors.instagramUrl}
      />
      <Input name="displayName" label="Görünen ad (opsiyonel)" placeholder="Ayşe Yılmaz" />
      <Textarea name="notes" label="Not (opsiyonel)" rows={2} />

      {state && !state.success && !state.fieldErrors && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">
          ✓ Influencer eklendi
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Vazgeç
        </Button>
        <Button type="submit" loading={pending}>Kaydet</Button>
      </div>
    </form>
  );
}
