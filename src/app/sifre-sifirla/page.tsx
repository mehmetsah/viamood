import Link from 'next/link';
import { checkResetToken, RESET_TOKEN_TTL_MS } from '@/lib/password-reset';
import { Logo } from '@/components/ui/Logo';
import { ResetForm } from './ResetForm';

export const dynamic = 'force-dynamic';

/**
 * Token GÖSTERMEDEN ÖNCE sunucuda doğrulanır — geçersiz/süresi geçmiş bağlantıda
 * form hiç render edilmez. Token burada TÜKETİLMEZ; tüketme, form gönderilince
 * `resetPasswordAction` içinde olur.
 */
export default async function SifreSifirlaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const check = await checkResetToken(token ?? '');
  const saat = Math.round(RESET_TOKEN_TTL_MS / 3_600_000);

  const hataMetni =
    check.valid === true
      ? null
      : check.reason === 'expired'
        ? `Bu bağlantının süresi dolmuş (${saat} saat geçerliydi).`
        : check.reason === 'used'
          ? 'Bu bağlantı daha önce kullanılmış.'
          : 'Bağlantı geçersiz.';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--color-brand-cream)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <Logo width={140} />
          </Link>
          <h1 className="text-2xl font-bold">Yeni şifre belirle</h1>
          {check.valid && (
            <p className="text-sm text-neutral-600 mt-1">{check.email}</p>
          )}
        </div>

        {check.valid ? (
          <ResetForm token={token ?? ''} />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
              {/* minimal çizgi ikon — uyarı */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-amber-600"
                aria-hidden="true"
              >
                <path d="M12 8.5v4.5" />
                <path d="M12 16.2h.01" />
                <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">
              {hataMetni} Yeni bir sıfırlama bağlantısı isteyebilirsin.
            </p>
            <Link
              href="/sifremi-unuttum"
              className="inline-block mt-6 text-sm text-[var(--color-brand-orange)] font-semibold hover:underline"
            >
              Yeni bağlantı iste
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
