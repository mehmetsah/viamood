import { fetchRecentShipments, type RecentShipment } from '@/lib/kargolab/shipments';

/**
 * Son gönderiler — KargoLab'den canlı.
 *
 * Rozet: `externalSource` dolu satırlar pazaryeri ekranından (Trendyol) oluşmuş
 * "ayna" kayıtlardır. Bunlar için KargoLab'de fiyat/cari hareketi üretilmez;
 * listede ciro gibi okunmamaları için kaynak açıkça işaretlenir.
 *
 * KargoLab erişilemezse panel tek başına uyarıya döner, sayfanın kalanı çalışır.
 */

function SourceBadge({ s }: { s: RecentShipment }) {
  if (!s.externalSource) {
    return <span className="text-xs text-neutral-400">KargoLab</span>;
  }
  const label = s.externalSource.charAt(0).toUpperCase() + s.externalSource.slice(1);
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700"
      title={
        `Pazaryeri ekranından oluşturuldu — ${label}` +
        (s.externalOrderNo ? ` (sipariş ${s.externalOrderNo})` : '')
      }
    >
      {label}
    </span>
  );
}

export default async function RecentShipmentsPanel() {
  let rows: RecentShipment[];

  try {
    rows = await fetchRecentShipments(10);
  } catch {
    return (
      <section className="mb-8">
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 text-sm text-neutral-600">
          <b className="text-neutral-900">Kargo listesi şu an alınamıyor.</b> KargoLab bağlantısı
          kurulamadı; diğer veriler etkilenmedi.
        </div>
      </section>
    );
  }

  const mirrored = rows.filter((r) => r.externalSource).length;

  return (
    <section className="mb-8">
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-bold">Son gönderiler</h2>
        {mirrored > 0 && (
          <span className="text-xs text-neutral-500">
            {mirrored} tanesi pazaryeri ekranından oluşturuldu
          </span>
        )}
        <a
          href="/admin/kargolab-gecis?target=shipments"
          className="ml-auto text-sm font-semibold text-blue-700 hover:underline"
        >
          Tümünü KargoLab&apos;de aç →
        </a>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-5 text-sm text-neutral-500">
          Henüz gönderi yok.
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200">
                <tr className="text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-2.5 font-semibold">Tarih</th>
                  <th className="px-4 py-2.5 font-semibold">Takip No</th>
                  <th className="px-4 py-2.5 font-semibold">Alıcı</th>
                  <th className="px-4 py-2.5 font-semibold">İl / İlçe</th>
                  <th className="px-4 py-2.5 font-semibold">Durum</th>
                  <th className="px-4 py-2.5 font-semibold">Kaynak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5 text-neutral-500 whitespace-nowrap">{r.createdAt}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.trackingNumber || '—'}</td>
                    <td className="px-4 py-2.5">{r.receiver || '—'}</td>
                    <td className="px-4 py-2.5 text-neutral-600">{r.city || '—'}</td>
                    <td className="px-4 py-2.5 text-neutral-600">{r.statusLabel || '—'}</td>
                    <td className="px-4 py-2.5">
                      <SourceBadge s={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
