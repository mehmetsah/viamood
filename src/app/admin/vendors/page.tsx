import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { vendors } from '@/db/schema';
import { approveVendorAction, rejectVendorAction, setCommissionAction, suspendVendorAction } from '@/lib/actions/admin';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Bekliyor', cls: 'bg-yellow-100 text-yellow-900' },
  active: { label: 'Aktif', cls: 'bg-green-100 text-green-900' },
  suspended: { label: 'Askıda', cls: 'bg-orange-100 text-orange-900' },
  rejected: { label: 'Reddedildi', cls: 'bg-red-100 text-red-900' },
  archived: { label: 'Arşiv', cls: 'bg-neutral-200 text-neutral-700' },
};

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminVendorsPage({ searchParams }: PageProps) {
  const { status: statusFilter } = await searchParams;

  const baseQuery = db.select().from(vendors);
  const list = statusFilter
    ? await baseQuery.where(eq(vendors.status, statusFilter as 'pending' | 'active' | 'suspended' | 'rejected' | 'archived')).orderBy(desc(vendors.createdAt))
    : await baseQuery.orderBy(desc(vendors.createdAt));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Tedarikçiler</h1>
          <p className="text-neutral-600 text-sm mt-1">{list.length} kayıt</p>
        </div>
        <div className="flex gap-2 text-sm">
          <a href="/admin/vendors" className={`px-3 py-1.5 rounded-lg border ${!statusFilter ? 'bg-[var(--color-brand-ink)] text-white' : 'hover:bg-neutral-100'}`}>
            Hepsi
          </a>
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <a
              key={key}
              href={`/admin/vendors?status=${key}`}
              className={`px-3 py-1.5 rounded-lg border ${statusFilter === key ? 'bg-[var(--color-brand-ink)] text-white' : 'hover:bg-neutral-100'}`}
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border text-center text-neutral-500">
          Bu filtrede tedarikçi yok
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((v) => {
            const status = STATUS_LABELS[v.status] ?? STATUS_LABELS.pending!;
            const commissionPct = (v.commissionRate / 100).toFixed(2);
            return (
              <div key={v.id} className="bg-white rounded-xl border p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold truncate">{v.name}</h3>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${status.cls}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="text-sm text-neutral-600">
                      <div>{v.legalName}</div>
                      <div className="text-neutral-500">
                        {v.email} · {v.phone}
                      </div>
                      <div className="text-neutral-500 text-xs mt-1">
                        Vergi: {v.taxId} · {v.taxOffice} · {v.city}/{v.district}
                      </div>
                      {v.iban && (
                        <div className="text-neutral-500 text-xs mt-1">IBAN: {v.iban}</div>
                      )}
                      {v.suspendedReason && (
                        <div className="text-red-600 text-xs mt-2">Sebep: {v.suspendedReason}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[260px]">
                    {v.status === 'pending' && (
                      <>
                        <form action={approveVendorAction}>
                          <input type="hidden" name="vendorId" value={v.id} />
                          <button
                            type="submit"
                            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700"
                          >
                            ✓ Onayla
                          </button>
                        </form>
                        <form action={rejectVendorAction} className="flex gap-2">
                          <input type="hidden" name="vendorId" value={v.id} />
                          <input
                            name="reason"
                            placeholder="Red sebebi"
                            className="flex-1 h-9 px-3 border rounded-lg text-sm"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
                          >
                            Reddet
                          </button>
                        </form>
                      </>
                    )}

                    {v.status === 'active' && (
                      <>
                        <form action={setCommissionAction} className="flex gap-2 items-center">
                          <input type="hidden" name="vendorId" value={v.id} />
                          <label className="text-xs text-neutral-500">Komisyon</label>
                          <input
                            type="number"
                            name="commissionRate"
                            defaultValue={commissionPct}
                            step="0.01"
                            min="0"
                            max="100"
                            className="w-20 h-8 px-2 border rounded text-sm"
                          />
                          <span className="text-xs">%</span>
                          <button
                            type="submit"
                            className="px-3 py-1 bg-neutral-800 text-white rounded text-xs font-semibold"
                          >
                            Kaydet
                          </button>
                        </form>
                        <form action={suspendVendorAction} className="flex gap-2">
                          <input type="hidden" name="vendorId" value={v.id} />
                          <input
                            name="reason"
                            placeholder="Askı sebebi"
                            className="flex-1 h-9 px-3 border rounded-lg text-sm"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700"
                          >
                            Askıya al
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-xs text-neutral-400 mt-3">
                  Slug: <code>{v.slug}</code> · Komisyon: %{commissionPct} · Ödeme:{' '}
                  {v.paymentMode === 'marketplace_split' ? 'Iyzico Split' : 'Cari'} · Oluşturulma:{' '}
                  {v.createdAt.toLocaleDateString('tr-TR')}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
