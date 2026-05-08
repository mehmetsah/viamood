import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');

  // Admin / super_admin vendor değil — admin paneline yönlendir
  if (session.user.role === 'admin' || session.user.role === 'super_admin') {
    redirect('/admin');
  }

  const [membership] = await db
    .select({
      vendorId: vendors.id,
      name: vendors.name,
      slug: vendors.slug,
      status: vendors.status,
      legalName: vendors.legalName,
      suspendedReason: vendors.suspendedReason,
      productCount: vendors.productCount,
      activeOrderCount: vendors.activeOrderCount,
      totalRevenueCents: vendors.totalRevenueCents,
      role: vendorMemberships.role,
    })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) redirect('/onboarding');

  const status = membership.status;
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';
  const isSuspended = status === 'suspended';

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">{membership.name}</h1>
      <p className="text-neutral-600 text-sm mb-8">Tedarikçi paneli özeti</p>

      {/* Status Banner */}
      {isPending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="text-2xl">⏳</div>
            <div>
              <h2 className="font-bold text-yellow-900">Başvurun onay bekliyor</h2>
              <p className="text-sm text-yellow-800 mt-1">
                Admin ekibimiz inceledikten sonra bilgi verilecek (genelde 1 iş günü). Onaylandıktan
                sonra ürün ekleyebilir, satış yapabilirsin.
              </p>
            </div>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="text-2xl">⛔</div>
            <div>
              <h2 className="font-bold text-red-900">Başvurun reddedildi</h2>
              {membership.suspendedReason && (
                <p className="text-sm text-red-800 mt-1">
                  <strong>Sebep:</strong> {membership.suspendedReason}
                </p>
              )}
              <p className="text-sm text-red-800 mt-1">
                Sorularını{' '}
                <a href="mailto:vendor@viamood.com" className="underline">
                  vendor@viamood.com
                </a>{' '}
                adresine yazabilirsin.
              </p>
            </div>
          </div>
        </div>
      )}

      {isSuspended && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="text-2xl">⚠️</div>
            <div>
              <h2 className="font-bold text-orange-900">Hesabın askıda</h2>
              {membership.suspendedReason && (
                <p className="text-sm text-orange-800 mt-1">{membership.suspendedReason}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 border">
          <div className="text-sm text-neutral-500">Ürün sayısı</div>
          <div className="text-3xl font-bold mt-2">{membership.productCount}</div>
        </div>
        <div className="bg-white rounded-xl p-6 border">
          <div className="text-sm text-neutral-500">Aktif sipariş</div>
          <div className="text-3xl font-bold mt-2">{membership.activeOrderCount}</div>
        </div>
        <div className="bg-white rounded-xl p-6 border">
          <div className="text-sm text-neutral-500">Toplam ciro</div>
          <div className="text-3xl font-bold mt-2">
            {(Number(membership.totalRevenueCents) / 100).toLocaleString('tr-TR', {
              minimumFractionDigits: 0,
            })}{' '}
            <span className="text-base font-normal text-neutral-500">TL</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border">
          <div className="text-sm text-neutral-500">Durum</div>
          <div className="text-base font-bold mt-2 capitalize">{status}</div>
        </div>
      </div>

      {/* Next steps */}
      <div className="bg-white rounded-xl p-6 border">
        <h2 className="font-bold mb-3">Sıradaki adımlar</h2>
        <ul className="space-y-2 text-sm text-neutral-700">
          <li>📦 Ürünler menüsünden ilk ürününü ekle</li>
          <li>📊 Stok ekranından stok seviyelerini kontrol et</li>
          <li>🚚 Faz 4: KargoLab fulfillment yakında</li>
          <li>💰 Faz 5: Komisyon ve ödeme raporu yakında</li>
        </ul>
      </div>
    </div>
  );
}
