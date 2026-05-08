'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await signIn('credentials', {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      redirect: false,
    });
    setPending(false);
    if (result?.error) {
      setError('E-posta veya şifre hatalı');
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--color-brand-cream)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <svg viewBox="0 0 254.18 156.78" width="120" aria-label="Via Mood">
              <polygon
                fill="#e1691f"
                points="243.74 82.24 127.45 6.94 10.44 82.24 15.97 82.25 127.45 10.5 238.17 82.21 243.74 82.24"
              />
              <text x="127" y="100" textAnchor="middle" fontSize="48" fontWeight="700" fill="#e1691f">
                VIA MOOD
              </text>
            </svg>
          </Link>
          <h1 className="text-2xl font-bold">Giriş Yap</h1>
          <p className="text-sm text-neutral-600 mt-1">Tedarikçi paneline hoş geldin</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-8 flex flex-col gap-4">
          <Input
            name="email"
            type="email"
            label="E-posta"
            placeholder="ornek@firma.com"
            required
            autoComplete="email"
          />
          <Input
            name="password"
            type="password"
            label="Şifre"
            required
            autoComplete="current-password"
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" loading={pending} fullWidth size="lg">
            Giriş yap
          </Button>
        </form>

        <p className="text-center text-sm text-neutral-600 mt-6">
          Hesabın yok mu?{' '}
          <Link href="/auth/sign-up" className="text-[var(--color-brand-orange)] font-semibold hover:underline">
            Tedarikçi başvurusu yap
          </Link>
        </p>
      </div>
    </div>
  );
}
