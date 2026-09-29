import { getPickupList } from '@/lib/routing/collection';
import { getLatestPickupRun } from '@/lib/routing/pickup-run';
import { generatePickupRunAction, markStopCollectedAction } from '@/lib/actions/pickup';
import { PickupControls, type RunView } from './PickupControls';

/**
 * FAZ 3.3 — Tedarikçiden Toplama.
 * Üstte: aktif toplama turu (rota + durak durumları, "Toplandı" aksiyonu).
 * Altta: stockLocation='supplier_pickup' bekleyen kalemlerin tedarikçi bazında dökümü.
 */

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Bekliyor',
  awaiting_pickup: 'Toplanacak',
  collected: 'Toplandı',
  received: 'Depoda',
  shipped: 'Kargoda',
  delivered: 'Teslim',
  cancelled: 'İptal',
  refunded: 'İade',
};

export default async function AdminToplamaPage() {
  const [groups, latest] = await Promise.all([getPickupList(), getLatestPickupRun()]);

  const runView: RunView | null = latest
    ? {
        id: latest.run.id,
        status: latest.run.status,
        runDate: latest.run.runDate,
        stopCount: latest.run.stopCount,
        itemCount: latest.run.itemCount,
        totalQuantity: latest.run.totalQuantity,
        stops: latest.stops.map((s) => ({
          id: s.id,
          seq: s.seq,
          vendorName: s.vendorName,
          city: s.city,
          district: s.district,
          itemCount: s.itemCount,
          totalQuantity: s.totalQuantity,
          status: s.status,
        })),
      }
    : null;

  const runActive = runView?.status === 'planned' || runView?.status === 'collecting';
  const canGenerate = groups.length > 0 && !runActive;

  const vendorCount = groups.length;
  const itemCount = groups.reduce((s, g) => s + g.itemCount, 0);
  const qtyTotal = groups.reduce((s, g) => s + g.totalQuantity, 0);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Tedarikçiden Toplama</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Stok konumu <strong>&ldquo;Tedarikçide — toplanacak&rdquo;</strong> ürünlerin gönderilmemiş
        kalemleri tek araçla toplanır: rota oluştur, tedarikçiden aldıkça durakları işaretle.
      </p>

      <PickupControls
        run={runView}
        canGenerate={canGenerate}
        generateAction={generatePickupRunAction}
        collectAction={markStopCollectedAction}
      />

      <h2 className="text-lg font-bold mb-3">Bekleyen kalemler (tedarikçi bazında)</h2>

      <div className="grid grid-cols-3 gap-4 mb-6 max-w-xl">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-neutral-500">Tedarikçi</div>
          <div className="text-2xl font-bold">{vendorCount}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-neutral-500">Kalem</div>
          <div className="text-2xl font-bold">{itemCount}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-neutral-500">Toplam adet</div>
          <div className="text-2xl font-bold">{qtyTotal}</div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-neutral-500">
          Şu an tedarikçiden toplanacak bekleyen kalem yok.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.vendorId} className="bg-white rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b bg-neutral-50">
                <div>
                  <h3 className="font-bold">{g.vendorName}</h3>
                  {(g.city || g.district) && (
                    <p className="text-xs text-neutral-500">
                      {[g.district, g.city].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                <div className="text-sm text-neutral-600">
                  {g.itemCount} kalem · <strong>{g.totalQuantity} adet</strong>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-500 border-b">
                    <th className="px-5 py-2 font-medium">Sipariş</th>
                    <th className="px-5 py-2 font-medium">Ürün</th>
                    <th className="px-5 py-2 font-medium">SKU</th>
                    <th className="px-5 py-2 font-medium text-right">Adet</th>
                    <th className="px-5 py-2 font-medium">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((it) => (
                    <tr key={it.lineItemId} className="border-b last:border-0">
                      <td className="px-5 py-2 whitespace-nowrap text-neutral-600">
                        {it.orderName || it.orderNumber || it.orderId.slice(0, 8)}
                      </td>
                      <td className="px-5 py-2">{it.title}</td>
                      <td className="px-5 py-2 text-neutral-500">{it.sku || '—'}</td>
                      <td className="px-5 py-2 text-right font-medium">{it.quantity}</td>
                      <td className="px-5 py-2">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs">
                          {STATUS_LABEL[it.status] ?? it.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
