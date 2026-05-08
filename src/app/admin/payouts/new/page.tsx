import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { vendors } from '@/db/schema';
import { Button } from '@/components/ui/Button';
import { createPayoutBatchAction } from '@/lib/actions/payout';

export default async function NewPayoutPage() {
  const vendorList = await db
    .select({ id: vendors.id, name: vendors.name, paymentMode: vendors.paymentMode })
    .from(vendors)
    .where(eq(vendors.status, 'active'))
    .orderBy(asc(vendors.name));

  // Default period: bu ayın 1'i — bugün
  const today = new Date();
  const startDefault = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const endDefault = today.toISOString().slice(0, 10);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href="/admin/payouts" className="text-sm text-neutral-600 hover:underline">
        ← Payouts
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-2">Yeni Payout Batch</h1>
      <p className="text-neutral-600 text-sm mb-8">
        Vendor için belirtilen periyot aralığındaki <strong>accrued</strong> hak edişleri toplayıp
        draft batch oluşturur. Sonra admin onayı + paid işaretleme yapılır.
      </p>

      {vendorList.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-sm">
          Aktif vendor yok — önce vendor onayı gerek.
        </div>
      ) : (
        <form action={createPayoutBatchAction} className="bg-white rounded-xl border p-6 flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Vendor</label>
            <select
              name="vendorId"
              required
              className="h-11 w-full px-4 rounded-lg border border-neutral-300 bg-white text-[15px]"
            >
              {vendorList.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.paymentMode})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Periyot başlangıç</label>
              <input
                type="date"
                name="periodStart"
                required
                defaultValue={startDefault}
                className="h-11 w-full px-4 rounded-lg border border-neutral-300 bg-white text-[15px]"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Periyot bitiş</label>
              <input
                type="date"
                name="periodEnd"
                required
                defaultValue={endDefault}
                className="h-11 w-full px-4 rounded-lg border border-neutral-300 bg-white text-[15px]"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Ödeme yöntemi</label>
            <select
              name="method"
              defaultValue="manual_bank"
              className="h-11 w-full px-4 rounded-lg border border-neutral-300 bg-white text-[15px]"
            >
              <option value="manual_bank">Manuel banka aktarımı (CSV export)</option>
              <option value="iyzico_split">Iyzico Pazaryeri Split</option>
              <option value="iyzico_transfer">Iyzico Transfer API</option>
              <option value="paytr_bk">PayTR Bağlı Kuruluş</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Not (opsiyonel)</label>
            <textarea
              name="note"
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-neutral-300 bg-white text-[15px] resize-y"
              placeholder="Bu batch ile ilgili herhangi bir not..."
            />
          </div>

          <Button type="submit" size="lg" className="self-start mt-2">
            Batch oluştur
          </Button>
        </form>
      )}
    </div>
  );
}
