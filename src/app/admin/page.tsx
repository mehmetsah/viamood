import { count, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { vendors } from '@/db/schema';

export default async function AdminDashboardPage() {
  const [pending] = await db.select({ count: count() }).from(vendors).where(eq(vendors.status, 'pending'));
  const [active] = await db.select({ count: count() }).from(vendors).where(eq(vendors.status, 'active'));
  const [suspended] = await db.select({ count: count() }).from(vendors).where(eq(vendors.status, 'suspended'));

  const stats = [
    { label: 'Bekleyen başvuru', value: pending?.count ?? 0, color: 'bg-yellow-100 text-yellow-900', href: '/admin/vendors?status=pending' },
    { label: 'Aktif tedarikçi', value: active?.count ?? 0, color: 'bg-green-100 text-green-900', href: '/admin/vendors?status=active' },
    { label: 'Askıdaki', value: suspended?.count ?? 0, color: 'bg-orange-100 text-orange-900', href: '/admin/vendors?status=suspended' },
  ];

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
      <p className="text-neutral-600 mb-8">Pazaryeri operatör görünümü</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <a
            key={s.label}
            href={s.href}
            className={`block rounded-xl p-6 ${s.color} hover:opacity-90 transition`}
          >
            <div className="text-sm font-medium">{s.label}</div>
            <div className="text-4xl font-bold mt-2">{s.value}</div>
          </a>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 border">
        <h2 className="font-bold mb-3">Sıradaki yapılacaklar</h2>
        <ul className="space-y-2 text-sm text-neutral-700">
          <li>📊 Phase 2: Tüm ürünler global view</li>
          <li>📦 Phase 3: Sipariş routing kuralları editörü</li>
          <li>💰 Phase 5: Payout batch onay UI</li>
          <li>🔍 Phase 6: Audit log viewer</li>
        </ul>
      </div>
    </div>
  );
}
