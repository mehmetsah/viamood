import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { signOutAction } from '@/lib/actions/auth';
import { Logo } from '@/components/ui/Logo';

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');

  const role = session.user.role;
  if (role !== 'vendor' && role !== 'vendor_admin' && role !== 'admin' && role !== 'super_admin') {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex bg-neutral-50">
      <aside className="w-60 bg-white border-r flex flex-col">
        <div className="p-6 border-b">
          <Link href="/dashboard" className="block">
            <Logo width={120} />
          </Link>
          <div className="text-xs text-neutral-500 mt-2">Tedarikçi Paneli</div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1 text-sm">
          <Link href="/dashboard" className="px-3 py-2 rounded-lg hover:bg-neutral-100">
            🏠 Özet
          </Link>
          <Link href="/products" className="px-3 py-2 rounded-lg hover:bg-neutral-100">
            📦 Ürünler
          </Link>
          <Link href="/bundles" className="px-3 py-2 rounded-lg hover:bg-neutral-100">
            🎁 Set Ürünler
          </Link>
          <Link href="/inventory" className="px-3 py-2 rounded-lg hover:bg-neutral-100">
            📊 Stok
          </Link>
          <Link href="/orders" className="px-3 py-2 rounded-lg hover:bg-neutral-100">
            🛒 Siparişler
          </Link>
          <Link href="/payouts" className="px-3 py-2 rounded-lg hover:bg-neutral-100">
            💰 Ödemeler
          </Link>
          <Link href="/profile" className="px-3 py-2 rounded-lg hover:bg-neutral-100">
            ⚙️ Profil
          </Link>
        </nav>
        <div className="p-3 border-t text-xs">
          <div className="text-neutral-500">{session.user.email}</div>
          <form action={signOutAction} className="mt-2">
            <button type="submit" className="text-neutral-500 hover:text-neutral-800">
              Çıkış
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
