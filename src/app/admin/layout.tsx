import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Logo } from '@/components/ui/Logo';
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
        <Link href="/admin" className="p-6 border-b border-white/10 block hover:bg-white/5">
          <div className="bg-white rounded-lg p-2 inline-block">
            <Logo width={130} />
          </div>
          <div className="text-xs uppercase tracking-widest opacity-60 mt-3">Yönetim Paneli</div>
        </Link>
        <nav className="flex-1 p-3 flex flex-col gap-1 text-sm">
          <Link href="/admin" className="px-3 py-2 rounded-lg hover:bg-white/10">📊 Dashboard</Link>
          <Link href="/admin/vendors" className="px-3 py-2 rounded-lg hover:bg-white/10">🏢 Tedarikçiler</Link>
          <Link href="/admin/products" className="px-3 py-2 rounded-lg hover:bg-white/10">📦 Tüm Ürünler</Link>
          <Link href="/admin/bundles" className="px-3 py-2 rounded-lg hover:bg-white/10">🎁 Set Ürünler</Link>
          <Link href="/admin/orders" className="px-3 py-2 rounded-lg hover:bg-white/10">🧾 Siparişler</Link>
          <Link href="/admin/payouts" className="px-3 py-2 rounded-lg hover:bg-white/10">💰 Ödemeler</Link>
          <Link href="/admin/routing-rules" className="px-3 py-2 rounded-lg hover:bg-white/10">🔀 Routing</Link>
          <Link href="/admin/shopify" className="px-3 py-2 rounded-lg hover:bg-white/10">🛒 Shopify</Link>
          <Link href="/admin/audit-log" className="px-3 py-2 rounded-lg hover:bg-white/10">📜 Audit Log</Link>
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
