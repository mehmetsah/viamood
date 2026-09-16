'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestPasswordResetAction, type ActionResult } from '@/lib/actions/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';

export default function SifremiUnuttumPage() {
  const [state, formAction, pending] = useActionState(
    async (_p: ActionResult | null, fd: FormData) => requestPasswordResetAction(fd),
    null as ActionResult | null,
  );

  const fieldErrors = state && !state.success ? (state.fieldErrors ?? {}) : {};

  // ⚠️ success === true "mail gitti" DEMEK DEĞİL. Sunucu isteği kabul ettiğinde de
  // true döner; mail kanalı hiç yapılandırılmamışsa `kanalKapali` ile işaretler.
  // 16 Eyl 2026'ya kadar burada yalnız success'e bakılıyordu ve canlıda müşteriye
  // hiç gönderilmemiş mail için yeşil onay basılıyordu — bu ayrım o yüzden var.
  const veri =
    state?.success === true
      ? (state.data as { message?: string; kanalKapali?: boolean } | undefined)
      : undefined;
  const kanalKapali = veri?.kanalKapali === true;
  const basarili = state?.success === true && !kanalKapali;
  const mesaj = veri?.message;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--color-brand-cream)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4"><Logo width={140} /></Link>
          <h1 className="text-2xl font-bold">Şifreni mi unuttun?</h1>
          <p className="text-sm text-neutral-600 mt-1">
            E-posta adresini gir, sıfırlama bağlantısı gönderelim
          </p>
        </div>

        {basarili ? (
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                   className="text-green-700" aria-hidden="true">
                <rect x="2.5" y="5" width="19" height="14" rx="2" />
                <path d="m3 7 8.4 5.6a1 1 0 0 0 1.2 0L21 7" />
              </svg>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">{mesaj}</p>
            <Link href="/auth/sign-in"
                  className="inline-block mt-6 text-sm text-[var(--color-brand-orange)] font-semibold hover:underline">
              Giriş sayfasına dön
            </Link>
          </div>
        ) : (
          <form action={formAction} className="bg-white rounded-2xl shadow-sm border p-8 flex flex-col gap-4">
            {/* Kanal kapalı: form AÇIK kalır — sunucu bu durumda oran sınırını
                tüketmediği için kullanıcı beklemeden tekrar deneyebilir. */}
            {kanalKapali && (
              <div role="status"
                   className="flex gap-3 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                     className="shrink-0 mt-0.5 text-amber-700" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7.5v5.25" />
                  <path d="M12 16.5h.01" />
                </svg>
                <p className="leading-relaxed">{mesaj}</p>
              </div>
            )}
            <Input name="email" type="email" label="E-posta" placeholder="ornek@eposta.com"
                   required autoComplete="email" error={fieldErrors.email} />
            {state && !state.success && !state.fieldErrors && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}
            <Button type="submit" loading={pending} fullWidth size="lg">
              Sıfırlama bağlantısı gönder
            </Button>
            <Link href="/auth/sign-in" className="text-center text-sm text-neutral-600 hover:underline mt-1">
              Giriş sayfasına dön
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
