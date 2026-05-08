import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { signOutAction } from '@/lib/actions/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <aside className="w-60 bg-[var(--color-brand-ink)] text-white flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="text-xs uppercase tracking-widest opacity-60">Admin</div>
          <div className="text-lg font-bold">Via Mood</div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1 text-sm">
          <Link href="/admin" className="px-3 py-2 rounded-lg hover:bg-white/10">📊 Dashboard</Link>
          <Link href="/admin/vendors" className="px-3 py-2 rounded-lg hover:bg-white/10">🏢 Tedarikçiler</Link>
          <Link href="/admin/orders" className="px-3 py-2 rounded-lg hover:bg-white/10">📦 Siparişler</Link>
          <Link href="/admin/payouts" className="px-3 py-2 rounded-lg hover:bg-white/10">💰 Ödemeler</Link>
          <Link href="/admin/routing-rules" className="px-3 py-2 rounded-lg hover:bg-white/10">🔀 Routing</Link>
        </nav>
        <div className="p-3 border-t border-white/10 text-xs">
          <div className="opacity-60">{session?.user?.email}</div>
          <form action={signOutAction} className="mt-2">
            <button type="submit" className="text-white/70 hover:text-white text-xs">Çıkış</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
