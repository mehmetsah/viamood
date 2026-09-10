'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';

function SignInInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Özel hedef yoksa /post-login → role'e göre (customer→/hesabim, vendor→/dashboard, admin→/admin)
  const callbackUrl = searchParams.get('callbackUrl') ?? '/post-login';
  // Müşteri portalından (tema "Hesabım") gelenler tedarikçi metni görmesin
  const musteri = callbackUrl.startsWith('/hesabim');
  // Şifre sıfırlama akışından dönenlere onay göster (bkz. /sifre-sifirla).
  const sifreYenilendi = searchParams.get('sifre') === 'yenilendi';
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
    <>
      <div className="text-center mb-8">
        <Link href="/" className="inline-block mb-4">
          <Logo width={140} />
        </Link>
        <h1 className="text-2xl font-bold">Giriş Yap</h1>
        <p className="text-sm text-neutral-600 mt-1">
          {musteri ? 'Via Mood hesabına hoş geldin' : 'Tedarikçi paneline hoş geldin'}
        </p>
      </div>

      {sifreYenilendi && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
          Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.
        </p>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-8 flex flex-col gap-4">
        <Input
          name="email"
          type="email"
          label="E-posta"
          placeholder={musteri ? 'ornek@eposta.com' : 'ornek@firma.com'}
          required
          autoComplete="email"
        />
        <div className="flex flex-col gap-1.5">
          <Input
            name="password"
            type="password"
            label="Şifre"
            required
            autoComplete="current-password"
          />
          <Link
            href="/sifremi-unuttum"
            className="self-end text-sm text-neutral-600 hover:text-[var(--color-brand-orange)] hover:underline"
          >
            Şifremi unuttum
          </Link>
        </div>

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
        {musteri ? (
          <Link
            href="/auth/customer-sign-up"
            className="text-[var(--color-brand-orange)] font-semibold hover:underline"
          >
            Üye ol
          </Link>
        ) : (
          <Link
            href="/auth/sign-up"
            className="text-[var(--color-brand-orange)] font-semibold hover:underline"
          >
            Tedarikçi başvurusu yap
          </Link>
        )}
      </p>
    </>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--color-brand-cream)]">
      <div className="w-full max-w-md">
        <Suspense
          fallback={
            <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-neutral-500">
              Yükleniyor…
            </div>
          }
        >
          <SignInInner />
        </Suspense>
      </div>
    </div>
  );
}
