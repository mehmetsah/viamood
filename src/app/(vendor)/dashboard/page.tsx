import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';
import { signOutAction } from '@/lib/actions/auth';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');

  // User'ın bağlı vendor'ı var mı?
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
      role: vendorMemberships.role,
    })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  // Membership yoksa onboarding'e
  if (!membership) redirect('/onboarding');

  const status = membership.status;
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';
  const isSuspended = status === 'suspended';

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)]">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 254.18 156.78" width="80" aria-label="Via Mood">
              <polygon
                fill="#e1691f"
                points="243.74 82.24 127.45 6.94 10.44 82.24 15.97 82.25 127.45 10.5 238.17 82.21 243.74 82.24"
              />
              <text x="127" y="100" textAnchor="middle" fontSize="48" fontWeight="700" fill="#e1691f">
                VIA MOOD
              </text>
            </svg>
            <span className="text-sm font-semibold text-neutral-500">| Tedarikçi Paneli</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold">{session.user.name ?? session.user.email}</div>
              <div className="text-xs text-neutral-500">{session.user.email}</div>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-sm px-3 py-2 rounded-lg hover:bg-neutral-100 text-neutral-600"
              >
                Çıkış
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        {/* Status Banner */}
        {isPending && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="text-2xl">⏳</div>
              <div>
                <h2 className="font-bold text-yellow-900">Başvurun onay bekliyor</h2>
                <p className="text-sm text-yellow-800 mt-1">
                  <strong>{membership.name}</strong> başvurunu aldık. Admin ekibimiz inceledikten sonra
                  (genelde 1 iş günü içinde) bilgi verilecek. Onaylandıktan sonra ürün ekleyebilir, satış
                  yapabilirsin.
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
                  Sorularını <a href="mailto:vendor@viamood.com" className="underline">vendor@viamood.com</a> adresine yazabilirsin.
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

        <h1 className="text-3xl font-bold mb-6">{membership.name}</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 border">
            <div className="text-sm text-neutral-500">Ürün sayısı</div>
            <div className="text-3xl font-bold mt-2">{membership.productCount}</div>
          </div>
          <div className="bg-white rounded-xl p-6 border">
            <div className="text-sm text-neutral-500">Aktif sipariş</div>
            <div className="text-3xl font-bold mt-2">{membership.activeOrderCount}</div>
          </div>
          <div className="bg-white rounded-xl p-6 border">
            <div className="text-sm text-neutral-500">Durum</div>
            <div className="text-base font-bold mt-2 capitalize">{status}</div>
          </div>
        </div>

        {/* Phase 2 placeholders */}
        <div className="bg-white rounded-xl p-6 border">
          <h2 className="font-bold mb-3">Sıradaki adımlar</h2>
          <ul className="space-y-2 text-sm text-neutral-700">
            <li>📦 Phase 2: Ürün ekle/düzenle (Shopify Admin API'ye senkronize)</li>
            <li>📊 Phase 2: Stok yönetimi</li>
            <li>🚚 Phase 4: KargoLab fulfillment</li>
            <li>💰 Phase 5: Komisyon ve ödeme raporu</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
