import { asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { shippingRateBrackets } from '@/db/schema';
import { ShippingRatesClient } from './ShippingRatesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kargo Tarifeleri — Via Mood Admin' };

export default async function ShippingRatesPage() {
  const brackets = await db
    .select()
    .from(shippingRateBrackets)
    .orderBy(asc(shippingRateBrackets.sortOrder));

  // Serialize bigints
  const data = brackets.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    weightLowGrams: b.weightLowGrams,
    weightHighGrams: b.weightHighGrams,
    countryCode: b.countryCode,
    kargolabBaseCents: b.kargolabBaseCents != null ? Number(b.kargolabBaseCents) : null,
    kargolabCourier: b.kargolabCourier,
    kargolabFetchedAt: b.kargolabFetchedAt,
    marginPct: b.marginPct,
    marginFlatCents: Number(b.marginFlatCents ?? 0),
    priceCents: Number(b.priceCents),
    currency: b.currency,
    status: b.status,
    shopifyMethodId: b.shopifyMethodId,
    shopifyPushedAt: b.shopifyPushedAt,
    sortOrder: b.sortOrder,
  }));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold mb-2">📦 Kargo Tarifeleri</h1>
        <p className="text-sm text-neutral-600 max-w-3xl">
          Vendor platform tek doğruluk kaynağı: KargoLab API'den base rate çek, margin
          uygula, tek tıkla Shopify Domestic zone'a yansıt. Multi-channel mimari —
          aynı bracket'lar WooCommerce / Trendyol vs.'ye de push edilebilir.
        </p>
      </header>
      <ShippingRatesClient initialBrackets={data} />
    </div>
  );
}
