import { desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { paymentRefunds } from '@/db/schema';
import IadeForm from './IadeForm';

export const dynamic = 'force-dynamic';

/**
 * Kart iadesi ekranı.
 *
 * 🔴 Bilerek ADMIN altında: iade para çıkışıdır. Müşteriye açık bir sayfada
 * sipariş no + tutar ile tetiklenebilseydi, sıralı sipariş numaraları
 * denenerek kötüye kullanılabilirdi. Buradaki layout admin/super_admin
 * dışındaki herkesi /dashboard'a yönlendirir.
 */
export default async function IadePage() {
  const kayitlar = await db.select().from(paymentRefunds).orderBy(desc(paymentRefunds.createdAt)).limit(25);

  const tl = (kurus: bigint) => (Number(kurus) / 100).toFixed(2);
  const rozet = (s: string) =>
    s === 'success' ? 'bg-green-100 text-green-800'
    : s === 'failed' ? 'bg-red-100 text-red-800'
    : 'bg-amber-100 text-amber-800';

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Kart İadesi</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Halköde (Halkbank) sanal POS üzerinden karta geri ödeme. Her deneme —
          başarısız olanlar dahil — aşağıdaki listeye kaydedilir.
        </p>
      </div>

      <IadeForm />

      <div>
        <h2 className="text-base font-medium mb-2">Son iade işlemleri</h2>
        {kayitlar.length === 0 ? (
          <p className="text-sm text-neutral-500">Henüz iade kaydı yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-2 pr-4">Tarih</th>
                  <th className="py-2 pr-4">Sipariş</th>
                  <th className="py-2 pr-4">İşlem No</th>
                  <th className="py-2 pr-4">Tutar</th>
                  <th className="py-2 pr-4">Durum</th>
                  <th className="py-2 pr-4">Banka cevabı</th>
                  <th className="py-2 pr-4">Yapan</th>
                </tr>
              </thead>
              <tbody>
                {kayitlar.map((k) => (
                  <tr key={k.id} className="border-t border-neutral-200">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(k.createdAt)}
                    </td>
                    <td className="py-2 pr-4">{k.orderName ?? '—'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{k.invoiceId}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{tl(k.amountCents)} TL</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded px-2 py-0.5 text-xs ${rozet(k.status)}`}>{k.status}</span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-neutral-600">{k.description ?? '—'}</td>
                    <td className="py-2 pr-4 text-xs text-neutral-600">{k.requestedBy ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
