'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { resetPasswordAction, type ActionResult } from '@/lib/actions/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function SifreSifirlaForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (_p: ActionResult | null, fd: FormData) => resetPasswordAction(fd),
    null as ActionResult | null,
  );
  const basarili = state?.success === true;

  useEffect(() => {
    if (!basarili) return;
    const t = setTimeout(() => router.push('/auth/sign-in?sifre=yenilendi'), 2000);
    return () => clearTimeout(t);
  }, [basarili, router]);

  const fieldErrors = state && !state.success ? (state.fieldErrors ?? {}) : {};

  if (basarili) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
               className="text-green-700" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
          </svg>
        </div>
        <p className="text-sm text-neutral-700 leading-relaxed">
          Şifren güncellendi. Giriş sayfasına yönlendiriliyorsun…
        </p>
        <Link href="/auth/sign-in"
              className="inline-block mt-6 text-sm text-[var(--color-brand-orange)] font-semibold hover:underline">
          Hemen giriş yap
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="bg-white rounded-2xl shadow-sm border p-8 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Input name="password" type="password" label="Yeni şifre" required
             autoComplete="new-password" hint="8+ karakter, büyük/küçük harf ve rakam"
             error={fieldErrors.password} />
      <Input name="passwordConfirm" type="password" label="Yeni şifre (tekrar)" required
             autoComplete="new-password" error={fieldErrors.passwordConfirm} />
      {state && !state.success && !state.fieldErrors && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      <Button type="submit" loading={pending} fullWidth size="lg">Şifreyi güncelle</Button>
    </form>
  );
}
