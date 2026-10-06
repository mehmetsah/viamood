'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { davetParolaBelirleAction } from '@/lib/actions/davet';
import type { ActionResult } from '@/lib/actions/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/** Parola YALNIZ burada, kullanıcının kendi tarayıcısında doğar; hiçbir yere yazılmaz. */
export function DavetForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (_p: ActionResult | null, fd: FormData) => davetParolaBelirleAction(fd),
    null as ActionResult | null,
  );
  const basarili = state?.success === true;

  useEffect(() => {
    if (!basarili) return;
    const t = setTimeout(() => router.push('/auth/sign-in?parola=olusturuldu'), 2000);
    return () => clearTimeout(t);
  }, [basarili, router]);

  const fieldErrors = state && !state.success ? (state.fieldErrors ?? {}) : {};

  if (basarili) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
        <p className="text-sm text-neutral-700 leading-relaxed">
          Parolan oluşturuldu. Giriş ekranına yönlendiriliyorsun.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="bg-white rounded-2xl shadow-sm border p-8 space-y-4">
      <input type="hidden" name="token" value={token} />
      <Input name="password" type="password" label="Yeni parola" required
             autoComplete="new-password" error={fieldErrors.password?.[0]} />
      <Input name="passwordConfirm" type="password" label="Parola (tekrar)" required
             autoComplete="new-password" error={fieldErrors.passwordConfirm?.[0]} />
      {state && !state.success && !Object.keys(fieldErrors).length && (
        <p className="text-sm text-red-600 leading-relaxed">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Kaydediliyor…' : 'Parolamı belirle'}
      </Button>
    </form>
  );
}
