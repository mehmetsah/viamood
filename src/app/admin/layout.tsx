import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Logo } from '@/components/ui/Logo';
import { signOutAction } from '@/lib/actions/auth';
import { sssYonetebilirMi, tamAdminMi } from '@/lib/yetki';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = session?.user?.role;
  const yetkiler = (session?.user as { yetkiler?: string[] } | undefined)?.yetkiler ?? [];
  // KAPI 2/3 — layout. sss_editor buraya girebilir ama yalnız SSS ekranı için;
  // yol denetimi middleware'de (KAPI 1/3). Burası doğrudan render denemesine karşı.
  if (!sssYonetebilirMi(role, yetkiler)) {
    redirect('/dashboard');
  }
  const yalnizSss = !tamAdminMi(role);

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <aside className="w-60 bg-[var(--color-brand-ink)] text-white flex flex-col sticky top-0 h-screen">
        <Link href="/admin" className="p-6 border-b border-white/10 block hover:bg-white/5 shrink-0">
          <div className="bg-white rounded-lg p-2 inline-block">
            <Logo width={130} />
          </div>
          <div className="text-xs uppercase tracking-widest opacity-60 mt-3">Yönetim Paneli</div>
        </Link>
        <nav className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-1 text-sm">
          {/* sss_editor için menü YALNIZ SSS linkini gösterir. Bu bir GÖRÜNTÜ kolaylığı —
              asıl kapı middleware + layout + action; menüyü gizlemek güvenlik DEĞİLDİR. */}
          {yalnizSss ? (
            <Link href="/admin/urun-sss" className="px-3 py-2 rounded-lg hover:bg-white/10">Ürün SSS</Link>
          ) : (
            <>
          <Link href="/admin" className="px-3 py-2 rounded-lg hover:bg-white/10">📊 Dashboard</Link>
          <Link href="/admin/vendors" className="px-3 py-2 rounded-lg hover:bg-white/10">🏢 Tedarikçiler</Link>
          <Link href="/admin/products" className="px-3 py-2 rounded-lg hover:bg-white/10">📦 Tüm Ürünler</Link>
          <Link href="/admin/bundles" className="px-3 py-2 rounded-lg hover:bg-white/10">🎁 Set Ürünler</Link>
          <Link href="/admin/orders" className="px-3 py-2 rounded-lg hover:bg-white/10">🧾 Siparişler</Link>
          <Link href="/admin/iade" className="px-3 py-2 rounded-lg hover:bg-white/10">Kart İadesi</Link>
          <Link href="/admin/customers" className="px-3 py-2 rounded-lg hover:bg-white/10">👤 Müşteriler</Link>
          <Link href="/admin/reviews" className="px-3 py-2 rounded-lg hover:bg-white/10">💬 Yorumlar</Link>
          <Link href="/admin/payouts" className="px-3 py-2 rounded-lg hover:bg-white/10">💰 Ödemeler</Link>
          <Link href="/admin/calculator" className="px-3 py-2 rounded-lg hover:bg-white/10">🧮 Fiyat Hesap</Link>
          <Link href="/admin/profitability" className="px-3 py-2 rounded-lg hover:bg-white/10">📈 Kârlılık Raporu</Link>
          <Link href="/admin/routing-rules" className="px-3 py-2 rounded-lg hover:bg-white/10">🔀 Routing</Link>
          <Link href="/admin/shopify" className="px-3 py-2 rounded-lg hover:bg-white/10">🛒 Shopify</Link>
          <Link href="/admin/shipping-rates" className="px-3 py-2 rounded-lg hover:bg-white/10">🚚 Kargo Tarifeleri</Link>
          <Link href="/admin/mikro" className="px-3 py-2 rounded-lg hover:bg-white/10">📦 Mikro V17</Link>
          <Link href="/admin/audit-log" className="px-3 py-2 rounded-lg hover:bg-white/10">📜 Audit Log</Link>
          {/* #991833: emoji BİLEREK konmadı (Mehmet Şah kalıcı kuralı). */}
          <Link href="/admin/urun-sss" className="px-3 py-2 rounded-lg hover:bg-white/10">Ürün SSS</Link>
          {/* #991691: emoji BİLEREK konmadı (Mehmet Şah kalıcı kuralı: emoji/AI-kokan ikon yasak).
              Komşu satırlardaki emojiler eski; yeni satır kurala uyuyor. */}
          <Link href="/admin/mail-gecmisi" className="px-3 py-2 rounded-lg hover:bg-white/10">Mail Gönderim Geçmişi</Link>
          <Link href="/admin/settings" className="px-3 py-2 rounded-lg hover:bg-white/10">⚙️ Ayarlar</Link>
          <Link href="/admin/theme" className="px-3 py-2 rounded-lg hover:bg-white/10">🎨 Tema Editörü</Link>
          <Link href="/admin/pages" className="px-3 py-2 rounded-lg hover:bg-white/10">📄 İçerik Sayfaları</Link>
            </>
          )}
        </nav>
        <div className="p-3 border-t border-white/10 text-xs shrink-0">
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
