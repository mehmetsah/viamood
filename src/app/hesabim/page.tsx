import Link from 'next/link';
import { and, count, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { fulfillments, orders, products, productVariants } from '@/db/schema';
import { getSessionCustomer } from '@/lib/customers/session';
import { CopyButton } from './_components/CopyButton';
import { Pagination, parsePage } from './_components/Pagination';
import { koridor, pul, siparisDurumu, tarih, tl, type Durum } from './_lib/format';

export const dynamic = 'force-dynamic';

const PAGE = 6;

type RawLI = {
  title?: string;
  quantity?: number;
  variant_title?: string | null;
  price?: string;
  variant_id?: number | string | null;
};

export default async function SiparislerimPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp);
  const customer = await getSessionCustomer();

  if (!customer) {
    return (
      <Bos
        baslik="Siparişlerini görmek için giriş yap"
        alt="Sipariş geçmişin ve kargo takibin burada görünecek."
      />
    );
  }

  const emailCond = or(
    eq(sql`lower(${orders.customerEmail})`, customer.email.toLowerCase()),
    customer.shopifyCustomerId ? eq(orders.customerId, customer.shopifyCustomerId) : sql`false`,
  );

  const [[toplamRow], [aktifRow], [teslimRow], list] = await Promise.all([
    db.select({ n: count() }).from(orders).where(emailCond),
    db
      .select({ n: count() })
      .from(orders)
      .where(and(emailCond, eq(orders.fulfillmentStatus, 'fulfilled'), sql`${orders.cancelledAt} is null`)),
    db
      .select({ n: count() })
      .from(orders)
      .where(and(emailCond, eq(orders.fulfillmentStatus, 'fulfilled'))),
    db
      .select()
      .from(orders)
      .where(emailCond)
      .orderBy(desc(orders.placedAt))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
  ]);

  const toplam = toplamRow?.n ?? 0;
  const yolda = aktifRow?.n ?? 0;
  const teslim = teslimRow?.n ?? 0;

  // görünen siparişlerin takip bilgisi
  const ids = list.map((o) => o.id);
  const fuls = ids.length
    ? await db
        .select({
          orderId: fulfillments.orderId,
          carrier: fulfillments.carrier,
          trackingNumber: fulfillments.trackingNumber,
          trackingUrl: fulfillments.trackingUrl,
        })
        .from(fulfillments)
        .where(and(inArray(fulfillments.orderId, ids), isNotNull(fulfillments.trackingNumber)))
    : [];
  const takipByOrder = new Map(fuls.map((f) => [f.orderId, f]));

  // Ürün galeri görselleri — raw line item variant_id → products.featuredImageUrl
  const rawVariantIds = Array.from(
    new Set(
      list
        .flatMap(
          (o) => ((o.rawShopifyPayload as { line_items?: RawLI[] } | null)?.line_items) ?? [],
        )
        .map((li) => (li.variant_id != null ? String(li.variant_id) : null))
        .filter((v): v is string => !!v),
    ),
  );
  const imgRows = rawVariantIds.length
    ? await db
        .select({
          vid: productVariants.shopifyVariantId,
          img: products.featuredImageUrl,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.shopifyVariantId, rawVariantIds))
    : [];
  const imgByVariant = new Map(
    imgRows.filter((r) => r.img).map((r) => [r.vid, r.img as string]),
  );
  const liImg = (li: RawLI) =>
    li.variant_id != null ? imgByVariant.get(String(li.variant_id)) : undefined;

  if (toplam === 0) {
    return (
      <>
        <Baslik ozet={{ toplam: 0, yolda: 0, teslim: 0 }} />
        <div className="vh-kart vh-bos">
          <span className="vh-cati" aria-hidden="true" />
          <b>Henüz siparişin yok.</b>
          İlk siparişini verdiğinde burada durumu ve kargo takibiyle görünecek.
          <div style={{ marginTop: 12 }}>
            <a href="https://viamood.com.tr">Alışverişe başla →</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Baslik ozet={{ toplam, yolda, teslim }} />

      {list.map((o, idx) => {
        const items = ((o.rawShopifyPayload as { line_items?: RawLI[] } | null)?.line_items) ?? [];
        const takip = takipByOrder.get(o.id);
        const durum = siparisDurumu({
          financialStatus: o.financialStatus,
          fulfillmentStatus: o.fulfillmentStatus,
          cancelledAt: o.cancelledAt,
          hasTracking: !!takip,
        });
        const adimlar = koridor({ cip: durum.cip, placedAt: o.placedAt });
        const havaleBekliyor =
          durum.cip === 'bekliyor' && (o.tags ?? []).some((t) => String(t).includes('havale'));
        const ad = o.shopifyOrderName ?? o.orderNumber ?? '#—';
        const teslimEdilebilir = o.fulfillmentStatus === 'fulfilled' && !o.cancelledAt;

        return (
          <details className="vh-kart vh-sip" key={o.id} open={idx === 0}>
            <summary>
              <div>
                <span className="vh-sip-no">{ad}</span>
                <span className="vh-sip-tarih">{tarih(o.placedAt)}</span>
              </div>
              <Cip durum={durum} />
              <div className="vh-pul-yigin" aria-hidden="true">
                {items.slice(0, 3).map((li, i) =>
                  i === 2 && items.length > 3 ? (
                    <span className="vh-pul" key={i}>{`+${items.length - 2}`}</span>
                  ) : (
                    <Pul key={i} img={liImg(li)} title={li.title} />
                  ),
                )}
              </div>
              <span className="vh-tutar">{tl(o.totalCents)}</span>
              <span className="vh-ok" aria-hidden="true">
                ▾
              </span>
            </summary>

            <div className="vh-detay">
              <div className="vh-koridor" style={{ gridTemplateColumns: `repeat(${adimlar.length},1fr)` }}>
                {adimlar.map((a, i) => (
                  <div className={`vh-adim ${a.hal}`} key={i}>
                    {a.ad}
                    <small>{a.alt}</small>
                  </div>
                ))}
              </div>

              {items.length > 0 && (
                <div className="vh-kalemler">
                  {items.map((li, i) => (
                    <div className="vh-kalem" key={i}>
                      <Pul img={liImg(li)} title={li.title} />
                      <div>
                        <b>{li.title}</b>
                        <span>
                          {li.quantity ?? 1} adet
                          {li.variant_title &&
                          li.variant_title !== 'Default Title' &&
                          li.variant_title !== 'Default'
                            ? ` · ${li.variant_title}`
                            : ''}
                        </span>
                      </div>
                      {li.price ? (
                        <span className="fiyat">{tl(Math.round(parseFloat(li.price) * 100))}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {havaleBekliyor && (
                <div className="vh-havale">
                  <span aria-hidden="true">🏦</span>
                  <div>
                    <b>Havale bekleniyor.</b> Açıklamaya <b>{ad}</b> yazarak 3 iş günü içinde
                    ödemeni tamamla; IBAN bilgileri onay e-postanda. Ödeme onaylanınca hazırlamaya
                    başlıyoruz.
                  </div>
                </div>
              )}

              {takip?.trackingNumber && (
                <>
                  <div className="vh-kargo">
                    <div>
                      <span className="etiket">{takip.carrier ?? 'Kargo'} · Takip No</span>
                      <span className="no">{takip.trackingNumber}</span>
                    </div>
                    <div className="vh-kargo-akt">
                      <CopyButton value={takip.trackingNumber} />
                      <a
                        className="vh-btn vh-btn-dolu"
                        href={
                          takip.trackingUrl ??
                          `https://kargolab.com/tracking/${takip.trackingNumber}`
                        }
                        target="_blank"
                        rel="noopener"
                      >
                        Kargoyu Takip Et →
                      </a>
                    </div>
                  </div>
                  {durum.cip === 'yolda' && (
                    <p className="vh-kargo-not">
                      Takip numarası, kargo firması paketi teslim aldıktan sonra kargo sitesinde
                      aktifleşir.
                    </p>
                  )}
                </>
              )}

              <div className="vh-alt">
                {teslimEdilebilir && (
                  <Link className="vh-btn vh-btn-bos" href={`/hesabim/iade-talebi/${o.id}`}>
                    İade talebi oluştur
                  </Link>
                )}
                <Link className="vh-btn vh-btn-sessiz" href="/hesabim/iadeler">
                  İadelerim
                </Link>
              </div>
            </div>
          </details>
        );
      })}

      <Pagination total={toplam} page={page} pageSize={PAGE} basePath="/hesabim" />
    </>
  );
}

function Baslik({ ozet }: { ozet: { toplam: number; yolda: number; teslim: number } }) {
  return (
    <>
      <div className="vh-baslik">
        <h1>Siparişlerim</h1>
        <p>{ozet.toplam} sipariş</p>
      </div>
      <div className="vh-ozet">
        <div className="vh-kart">
          <b>{ozet.toplam}</b>
          <span>Toplam</span>
        </div>
        <div className="vh-kart">
          <b style={{ color: 'var(--vh-turuncu)' }}>{ozet.yolda}</b>
          <span>Yolda</span>
        </div>
        <div className="vh-kart">
          <b style={{ color: 'var(--vh-iyi)' }}>{ozet.teslim}</b>
          <span>Teslim</span>
        </div>
      </div>
    </>
  );
}

function Cip({ durum }: { durum: Durum }) {
  return <span className={`vh-cip ${durum.cip}`}>{durum.metin}</span>;
}

/** Ürün pulu — galeri görseli varsa onu, yoksa baş harfleri gösterir */
function Pul({ img, title }: { img?: string; title?: string }) {
  if (!img) return <span className="vh-pul">{pul(title)}</span>;
  return (
    <span className="vh-pul vh-pul-gorsel">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={title ?? ''} loading="lazy" />
    </span>
  );
}

function Bos({ baslik, alt }: { baslik: string; alt: string }) {
  return (
    <>
      <div className="vh-baslik">
        <h1>Siparişlerim</h1>
      </div>
      <div className="vh-kart vh-bos">
        <span className="vh-cati" aria-hidden="true" />
        <b>{baslik}</b>
        {alt}
      </div>
    </>
  );
}
