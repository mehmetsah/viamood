import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';
import { formatTRY } from '@/lib/kargolab/statement';
import {
  fetchMemberShipments,
  fetchMemberStatementSummary,
  isTenantConfigured,
} from '@/lib/kargolab/tenant';

/**
 * Tedarikçi → Kargo & Cari
 *
 * ⚠️ Admin ekranından (/admin/kargo) FARKLI veri kaynağı kullanır:
 *    admin  → ana tenant, Via Mood'un kendi müşteri hesabı (üye 7000070)
 *    burası → Via Mood tenant'ı, TEDARİKÇİNİN KENDİ üyesi (vendors.kargolabMemberId)
 *
 * Kapsam KargoLab tarafında uygulanır: tedarikçi adına üye token'ı alınır ve
 * normal üye uçları o token'la çağrılır. Panel "hangi üyenin verisi" diye
 * filtrelemeye çalışmaz — filtreyi panelde yapmak, bir hata durumunda başka
 * tedarikçinin verisini göstermeye açık kapı bırakırdı.
 */

function Card({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'neutral' | 'good' | 'bad';
}) {
  const cls = { neutral: 'text-neutral-900', good: 'text-green-700', bad: 'text-red-700' }[tone];
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${cls}`}>{value}</div>
      {note && <div className="text-xs text-neutral-500 mt-0.5">{note}</div>}
    </div>
  );
}

/**
 * Gönderinin nerede oluşturulduğu.
 *
 * `externalSource` dolu satırlar pazaryeri ekranından (Trendyol vb.) oluşmuştur;
 * KargoLab üzerinden açılmamıştır. Tedarikçi "bunu ben oluşturmadım" dediğinde
 * cevabı bu sütun verir. Admin ekranıyla (/admin/kargo) aynı anlamı taşır.
 */
function KaynakRozeti({ kaynak, siparisNo }: { kaynak: string; siparisNo: string }) {
  if (!kaynak) return <span className="text-xs text-neutral-400">KargoLab</span>;
  const etiket = kaynak.charAt(0).toUpperCase() + kaynak.slice(1);
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700"
      title={`Pazaryeri ekranından oluşturuldu — ${etiket}` + (siparisNo ? ` (sipariş ${siparisNo})` : '')}
    >
      {etiket}
    </span>
  );
}

function Bilgi({ baslik, metin }: { baslik: string; metin: string }) {
  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
      <b className="text-neutral-900">{baslik}</b>
      <p className="text-sm text-neutral-600 mt-1">{metin}</p>
    </div>
  );
}

export default async function VendorKargoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');
  if (session.user.role === 'admin' || session.user.role === 'super_admin') redirect('/admin/kargo');

  const [membership] = await db
    .select({
      vendorId: vendors.id,
      name: vendors.name,
      status: vendors.status,
      kargolabMemberId: vendors.kargolabMemberId,
      kargolabSyncError: vendors.kargolabSyncError,
    })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) redirect('/onboarding');

  const baslik = (
    <>
      <h1 className="text-3xl font-bold mb-2">Kargo &amp; Cari</h1>
      <p className="text-neutral-600 text-sm mb-8">
        Gönderileriniz ve cari durumunuz — KargoLab&apos;den canlı.
      </p>
    </>
  );

  // Onaylanmamış tedarikçinin KargoLab üyeliği açılmaz.
  if (membership.status !== 'active') {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        {baslik}
        <Bilgi
          baslik="Başvurunuz henüz onaylanmadı."
          metin="Tedarikçi başvurunuz onaylandığında kargo hesabınız otomatik açılır ve gönderileriniz burada görünür."
        />
      </div>
    );
  }

  if (!isTenantConfigured() || !membership.kargolabMemberId) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        {baslik}
        <Bilgi
          baslik="Kargo hesabınız henüz hazırlanıyor."
          metin={
            membership.kargolabSyncError
              ? 'Hesap açılışı sırasında bir sorun oluştu; ekibimiz bilgilendirildi. Kısa süre içinde tekrar deneyin.'
              : 'Kargo hesabınız oluşturulduğunda gönderileriniz ve cari durumunuz burada görünecek.'
          }
        />
      </div>
    );
  }

  const memberId = membership.kargolabMemberId;

  // KargoLab erişilemezse sayfa çökmesin — bölüm bazında bozulur.
  const [ozet, gonderiler] = await Promise.all([
    fetchMemberStatementSummary(memberId).catch(() => null),
    fetchMemberShipments(memberId, 10).catch(() => null),
  ]);

  const borclu = ozet?.balance.status === 'debtor';

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {baslik}

      {ozet ? (
        <section className="mb-8">
          <div className="flex items-baseline gap-3 mb-3 flex-wrap">
            <h2 className="text-lg font-bold">Cari durum</h2>
            <span className="text-xs text-neutral-500">
              {ozet.period.date_start} – {ozet.period.date_end}
            </span>
          </div>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}
          >
            <Card
              label="Bakiye"
              value={formatTRY(ozet.balance.amount)}
              note={borclu ? 'borçlu' : ozet.balance.status === 'creditor' ? 'alacaklı' : 'kapalı'}
              tone={borclu ? 'bad' : ozet.balance.status === 'creditor' ? 'good' : 'neutral'}
            />
            <Card
              label="Bu dönem çıkan"
              value={formatTRY(ozet.period.out)}
              note={`${ozet.period.count} hareket`}
            />
            <Card label="Bu dönem giren" value={formatTRY(ozet.period.in)} tone="good" />
            <Card
              label="Bekleyen tahsilat"
              value={formatTRY(ozet.cod_pending.net_amount)}
              note={ozet.cod_pending.count > 0 ? `${ozet.cod_pending.count} gönderi` : 'yok'}
              tone={ozet.cod_pending.net_amount > 0 ? 'good' : 'neutral'}
            />
          </div>
        </section>
      ) : (
        <section className="mb-8">
          <Bilgi
            baslik="Cari özeti şu an alınamıyor."
            metin="KargoLab bağlantısı kurulamadı; diğer veriler etkilenmedi."
          />
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold mb-3">Son gönderiler</h2>
        {!gonderiler ? (
          <Bilgi
            baslik="Gönderi listesi şu an alınamıyor."
            metin="KargoLab bağlantısı kurulamadı; kısa süre sonra tekrar deneyin."
          />
        ) : gonderiler.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-5 text-sm text-neutral-500">
            Henüz gönderiniz yok.
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
                  {gonderiler.map((g) => (
                    <tr key={g.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-2.5 text-neutral-500 whitespace-nowrap">{g.createdAt}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{g.trackingNumber || '—'}</td>
                      <td className="px-4 py-2.5">{g.receiver || '—'}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{g.city || '—'}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{g.statusLabel || '—'}</td>
                      <td className="px-4 py-2.5">
                        <KaynakRozeti kaynak={g.externalSource} siparisNo={g.externalOrderNo} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
