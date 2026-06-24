'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { customerSignUpAction, type ActionResult } from '@/lib/actions/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';

const initialState: ActionResult | null = null;

export default function CustomerSignUpPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => customerSignUpAction(formData),
    initialState,
  );

  const fieldErrors = state && !state.success ? state.fieldErrors ?? {} : {};

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--color-brand-cream)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <Logo width={140} />
          </Link>
          <h1 className="text-2xl font-bold">Hesap Oluştur</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Siparişlerini takip et, adreslerini kaydet
          </p>
        </div>

        <form action={formAction} className="bg-white rounded-2xl shadow-sm border p-8 flex flex-col gap-4">
          <Input
            name="name"
            label="Ad Soyad"
            placeholder="Adınız Soyadınız"
            required
            error={fieldErrors.name}
            autoComplete="name"
          />
          <Input
            name="email"
            type="email"
            label="E-posta"
            placeholder="ornek@eposta.com"
            required
            error={fieldErrors.email}
            autoComplete="email"
          />
          <Input
            name="password"
            type="password"
            label="Şifre"
            required
            error={fieldErrors.password}
            hint="8+ karakter, büyük/küçük harf ve rakam"
            autoComplete="new-password"
          />
          <Input
            name="passwordConfirm"
            type="password"
            label="Şifre (tekrar)"
            required
            error={fieldErrors.passwordConfirm}
            autoComplete="new-password"
          />

          {state && !state.success && !state.fieldErrors && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <Button type="submit" loading={pending} fullWidth size="lg">
            Hesap oluştur
          </Button>
        </form>

        <p className="text-center text-sm text-neutral-600 mt-6">
          Zaten hesabın var mı?{' '}
          <Link href="/auth/sign-in" className="text-[var(--color-brand-orange)] font-semibold hover:underline">
            Giriş yap
          </Link>
        </p>
      </div>
    </div>
  );
}
