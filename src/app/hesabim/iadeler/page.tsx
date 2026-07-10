import Link from 'next/link';
import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { returns } from '@/db/schema';
import { getSessionCustomer } from '@/lib/customers/session';
import { CopyButton } from '../_components/CopyButton';
import { Pagination, parsePage } from '../_components/Pagination';
import { koridor, pul, tarih, tl } from '../_lib/format';

export const dynamic = 'force-dynamic';

const PAGE = 6;

const DURUM: Record<string, { metin: string; cip: 'yolda' | 'teslim' | 'bekliyor' | 'iptal' }> = {
  awaiting_shipment: { metin: 'Kargo bekleniyor', cip: 'yolda' },
  in_review: { metin: 'İncelemede', cip: 'bekliyor' },
  completed: { metin: 'İade tamamlandı', cip: 'teslim' },
  rejected: { metin: 'Reddedildi', cip: 'iptal' },
};

function iadeKoridor(status: string, olusturma: Date) {
  const sira = ['awaiting_shipment', 'in_review', 'completed'];
  const idx = status === 'rejected' ? 1 : sira.indexOf(status);
  const adlar = ['Talep alındı', 'Kargo/İnceleme', 'İade tamam'];
  return adlar.map((ad, i) => ({
    ad: status === 'rejected' && i === 1 ? 'Reddedildi' : ad,
    alt: i === 0 ? tarih(olusturma) : i <= idx ? '✓' : '—',
    hal: (i < idx ? 'oldu' : i === idx ? 'simdi' : '') as 'oldu' | 'simdi' | '',
  }));
}

export default async function IadelerimPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp);
  const customer = await getSessionCustomer();

  const [toplam, list] = customer
    ? await Promise.all([
        db
          .select({ n: count() })
          .from(returns)
          .where(eq(returns.customerId, customer.id))
          .then((r) => r[0]?.n ?? 0),
        db
          .select()
          .from(returns)
          .where(eq(returns.customerId, customer.id))
          .orderBy(desc(returns.createdAt))
          .limit(PAGE)
          .offset((page - 1) * PAGE),
      ])
    : [0, []];

  return (
    <>
      <div className="vh-baslik">
        <h1>İadelerim</h1>
        <p>{toplam > 0 ? `${toplam} iade talebi` : 'İade geçmişin'}</p>
      </div>

      {list.map((r) => {
        const d = DURUM[r.status] ?? DURUM.awaiting_shipment;
        const adimlar = iadeKoridor(r.status, r.createdAt);
        const aktif = r.status === 'awaiting_shipment';
        return (
          <div className="vh-kart" style={{ padding: 18, marginBottom: 14 }} key={r.id}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}
            >
              <div>
                <span className="vh-sip-no">İade · {r.orderName ?? ''}</span>
                <span className="vh-sip-tarih">Talep: {tarih(r.createdAt)}</span>
              </div>
              <span className={`vh-cip ${d!.cip}`}>{d!.metin}</span>
              <span className="vh-tutar" style={{ marginLeft: 'auto' }}>
                {tl(r.refundAmountCents)}
              </span>
            </div>

            <div className="vh-koridor" style={{ gridTemplateColumns: `repeat(${adimlar.length},1fr)` }}>
              {adimlar.map((a, i) => (
                <div className={`vh-adim ${a.hal}${r.status === 'rejected' && i === 1 ? ' iptal-adim' : ''}`} key={i}>
                  {a.ad}
                  <small>{a.alt}</small>
                </div>
              ))}
            </div>

            {r.lineItems.length > 0 && (
              <div className="vh-kalemler">
                {r.lineItems.map((li, i) => (
                  <div className="vh-kalem" key={i}>
                    <span className="vh-pul">{pul(li.title)}</span>
                    <div>
                      <b>{li.title}</b>
                      <span>İade nedeni: {r.reason}</span>
                    </div>
                    {li.priceCents ? <span className="fiyat">{tl(li.priceCents)}</span> : null}
                  </div>
                ))}
              </div>
            )}

            {aktif && (
              <div className="vh-iade-kod">
                <div>
                  <span className="etk">{r.carrier ?? 'PTT'} iade kodu</span>
                  <br />
                  <span className="no">{r.returnCode}</span>
                  <p>
                    Bu kodu {r.carrier ?? 'PTT'} şubesinde söylemen yeterli — <b>kargo ücreti bizden.</b>{' '}
                    Paket bize ulaşınca 2 iş günü içinde incelenir.
                  </p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <CopyButton value={r.returnCode} className="vh-btn vh-btn-dolu" label="Kodu Kopyala" />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="vh-kart vh-bos">
        <span className="vh-cati" aria-hidden="true" />
        <b>İade etmek istediğin bir ürün mü var?</b>
        Teslimattan sonraki 14 gün içinde, <Link href="/hesabim">Siparişlerim</Link>&apos;den tek
        tıkla talep oluşturabilirsin.
      </div>

      <Pagination total={toplam} page={page} pageSize={PAGE} basePath="/hesabim/iadeler" />
    </>
  );
}
