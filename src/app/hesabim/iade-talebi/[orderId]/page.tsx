import Link from 'next/link';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders, returns } from '@/db/schema';
import { getSessionCustomer } from '@/lib/customers/session';
import { createReturnRequest } from '@/lib/actions/returns';
import { pul, tarih, tl } from '../../_lib/format';

export const dynamic = 'force-dynamic';

const NEDENLER = [
  'Beklediğim boyutta/renkte değil',
  'Üründe hasar/kusur var',
  'Yanlış ürün geldi',
  'Fikrimi değiştirdim',
  'Diğer',
];

type RawLI = { title?: string; quantity?: number; price?: string };

export default async function IadeTalebiPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const customer = await getSessionCustomer();

  const [o] = customer
    ? await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, orderId),
            eq(sql`lower(${orders.customerEmail})`, customer.email.toLowerCase()),
          ),
        )
        .limit(1)
    : [];

  if (!o) {
    return (
      <>
        <div className="vh-baslik">
          <h1>İade talebi</h1>
        </div>
        <div className="vh-kart vh-bos">
          <span className="vh-cati" aria-hidden="true" />
          <b>Sipariş bulunamadı.</b>
          <div style={{ marginTop: 12 }}>
            <Link href="/hesabim">← Siparişlerime dön</Link>
          </div>
        </div>
      </>
    );
  }

  // Zaten aktif iade var mı?
  const [mevcut] = await db
    .select({ id: returns.id })
    .from(returns)
    .where(and(eq(returns.orderId, orderId), sql`${returns.status} <> 'rejected'`))
    .limit(1);

  const items = ((o.rawShopifyPayload as { line_items?: RawLI[] } | null)?.line_items) ?? [];
  const ad = o.shopifyOrderName ?? o.orderNumber ?? '#—';

  if (mevcut) {
    return (
      <>
        <div className="vh-baslik">
          <h1>İade talebi</h1>
        </div>
        <div className="vh-kart vh-bos">
          <span className="vh-cati" aria-hidden="true" />
          <b>Bu sipariş için zaten bir iade talebin var.</b>
          <div style={{ marginTop: 12 }}>
            <Link href="/hesabim/iadeler">İadelerime git →</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="vh-baslik">
        <h1>İade talebi</h1>
        <p>
          {ad} · {tarih(o.placedAt)}
        </p>
      </div>

      <div className="vh-kart" style={{ padding: 20 }}>
        <div className="vh-kalemler">
          {items.map((li, i) => (
            <div className="vh-kalem" key={i}>
              <span className="vh-pul">{pul(li.title)}</span>
              <div>
                <b>{li.title}</b>
                <span>{li.quantity ?? 1} adet</span>
              </div>
              {li.price ? (
                <span className="fiyat">{tl(Math.round(parseFloat(li.price) * 100))}</span>
              ) : null}
            </div>
          ))}
        </div>

        <form action={createReturnRequest} style={{ marginTop: 8 }}>
          <input type="hidden" name="order_id" value={o.id} />
          <div className="vh-alan" style={{ marginBottom: 16 }}>
            <label htmlFor="neden">İade nedeni</label>
            <select id="neden" name="reason" required defaultValue="">
              <option value="" disabled>
                Bir neden seç…
              </option>
              {NEDENLER.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="vh-iade-kod" style={{ marginBottom: 18 }}>
            <div>
              <span className="etk">Nasıl işliyor?</span>
              <p style={{ opacity: 0.85 }}>
                Talebini oluşturunca sana bir <b>PTT iade kodu</b> vereceğiz. Ürünü paketleyip en
                yakın PTT şubesinde bu kodu söyle — <b>kargo ücreti bizden.</b> Paket bize ulaşınca
                2 iş günü içinde iaden işlenir.
              </p>
            </div>
          </div>

          <div className="vh-alt" style={{ marginTop: 0 }}>
            <button type="submit" className="vh-btn vh-btn-dolu">
              İade talebini oluştur
            </button>
            <Link href="/hesabim" className="vh-btn vh-btn-sessiz">
              Vazgeç
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
