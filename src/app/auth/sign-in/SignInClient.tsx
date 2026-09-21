'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent, type ReactNode } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';

export type SosyalGiris = { google: boolean; facebook: boolean };

/**
 * Sosyal sağlayıcı başına YALNIZ ad ve resmi işaret değişir; düğmenin sınıfı,
 * yapısı ve davranışı tek yerde (SosyalDugme) yaşar. Facebook düğmesi Google
 * düğmesinin birebir kalıbıdır — yeni bir biçim ya da öğe eklenmez.
 */
const SOSYAL: Record<keyof SosyalGiris, { ad: string; ikon: ReactNode }> = {
  google: {
    ad: 'Google',
    ikon: (
      /* Google G — resmi renkli logo */
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2.1 5.1-4.4 6.700v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.2z"/>
        <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"/>
        <path fill="#FBBC05" d="M11.6 28.2c-.5-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.3C2.8 17 2 20.4 2 24s.8 7 2.3 9.9l7.3-5.7z"/>
        <path fill="#EA4335" d="M24 10.7c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C34.9 4.1 30 2 24 2 15.4 2 7.9 6.9 4.3 14.1l7.3 5.7c1.8-5.2 6.6-9.1 12.4-9.1z"/>
      </svg>
    ),
  },
  facebook: {
    ad: 'Facebook',
    ikon: (
      /* Facebook "f" — resmi mavi daire işareti */
      <svg width="18" height="18" viewBox="0 0 1024 1024" aria-hidden="true">
        <path fill="#1877F2" d="M1024 512C1024 229.23 794.77 0 512 0S0 229.23 0 512c0 255.55 187.23 467.37 432 505.78V660H302V512h130V399.2C432 270.88 508.44 200 625.39 200c56 0 114.61 10 114.61 10v126h-64.56c-63.6 0-83.44 39.47-83.44 80v96h142l-22.7 148H592v357.78C836.77 979.37 1024 767.55 1024 512z"/>
        <path fill="#fff" d="M711.3 660 734 512H592v-96c0-40.49 19.84-80 83.44-80H740V210s-58.59-10-114.61-10C508.44 200 432 270.88 432 399.2V512H302v148h130v357.78a517.58 517.58 0 0 0 160 0V660z"/>
      </svg>
    ),
  },
};

/** Sosyal giriş düğmesi — Google ve Facebook için TEK bileşen. */
export function SosyalDugme({
  saglayici,
  callbackUrl,
}: {
  saglayici: keyof SosyalGiris;
  callbackUrl: string;
}) {
  const s = SOSYAL[saglayici];
  return (
    <button
      type="button"
      onClick={() => signIn(saglayici, { callbackUrl })}
      className="w-full h-12 inline-flex items-center justify-center gap-3 rounded-full border-2 border-neutral-200 bg-white font-semibold text-[15px] hover:bg-neutral-50 transition"
    >
      {s.ikon}
      {`${s.ad} ile devam et`}
    </button>
  );
}

function SignInInner({ sosyal }: { sosyal: SosyalGiris }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Özel hedef yoksa /post-login → role'e göre (customer→/hesabim, vendor→/dashboard, admin→/admin)
  const callbackUrl = searchParams.get('callbackUrl') ?? '/post-login';
  // Müşteri portalından (tema "Hesabım") gelenler tedarikçi metni görmesin
  const musteri = callbackUrl.startsWith('/hesabim');
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

      {(sosyal.google || sosyal.facebook) && (
        <div className="mb-4">
          {/* Sıra sabit: Google, sonra Facebook. İkisi de AYNI bileşenden çizilir. */}
          <div className="flex flex-col gap-3">
            {sosyal.google && <SosyalDugme saglayici="google" callbackUrl={callbackUrl} />}
            {sosyal.facebook && <SosyalDugme saglayici="facebook" callbackUrl={callbackUrl} />}
          </div>
          <div className="flex items-center gap-3 my-4">
            <span className="h-px bg-neutral-200 flex-1" />
            <span className="text-xs text-neutral-500">veya</span>
            <span className="h-px bg-neutral-200 flex-1" />
          </div>
        </div>
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
            href="/auth/sifremi-unuttum"
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

export function SignInClient({ sosyal }: { sosyal: SosyalGiris }) {
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
          <SignInInner sosyal={sosyal} />
        </Suspense>
      </div>
    </div>
  );
}
