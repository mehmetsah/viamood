import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOutAction } from '@/lib/actions/auth';
import { auth } from '@/lib/auth';
import { Logo } from '@/components/ui/Logo';

export default async function HesabimLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Defans katmanı (middleware zaten korur): sadece müşteri.
  if (session?.user?.role !== 'customer') redirect('/post-login');

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)]">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/hesabim" className="flex items-center gap-3">
            <Logo width={110} />
            <span className="text-sm font-semibold text-neutral-500 hidden sm:inline">Hesabım</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/hesabim" className="px-3 py-2 rounded-lg hover:bg-neutral-100">Siparişlerim</Link>
            <Link href="/hesabim/adresler" className="px-3 py-2 rounded-lg hover:bg-neutral-100">Adreslerim</Link>
            <Link href="/hesabim/profil" className="px-3 py-2 rounded-lg hover:bg-neutral-100">Profil</Link>
            <form action={signOutAction}>
              <button type="submit" className="px-3 py-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100">
                Çıkış
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
