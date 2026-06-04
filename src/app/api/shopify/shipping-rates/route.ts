/**
 * Shopify CarrierService callback endpoint
 *
 * Shopify, checkout sırasında bu URL'i POST'lar — cart içeriği + alıcı adresi.
 * Biz KargoLab'a quote atar, kuryer listesini Shopify formatında geri döneriz.
 *
 * Müşteri checkout'ta gerçek KargoLab fiyatlarını görür (PTT, SÜRAT, MNG vs.)
 *
 * Setup:
 *   1. Bu endpoint'i bir kez Shopify'da CarrierService olarak register et:
 *      POST /admin/api/2025-01/carrier_services.json
 *      Body: { carrier_service: { name: "KargoLab", callback_url: "<this URL>",
 *              service_discovery: true, format: "json" } }
 *   2. Shopify her checkout'ta bu endpoint'i çağırır.
 *
 * @see https://shopify.dev/docs/api/admin-rest/2025-01/resources/carrierservice
 */
import { NextResponse, type NextRequest } from 'next/server';
import { quoteShipmentRate, type CourierRate } from '@/lib/kargolab/rates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ShopifyRateRequest {
  rate?: {
    origin?: { country?: string; postal_code?: string; province?: string; city?: string };
    destination?: { country?: string; postal_code?: string; province?: string; city?: string };
    items?: Array<{
      name?: string;
      sku?: string;
      quantity: number;
      grams: number;
      price?: number;
      requires_shipping?: boolean;
      taxable?: boolean;
      variant_id?: number;
      product_id?: number;
    }>;
    currency?: string;
    locale?: string;
  };
}

interface ShopifyRate {
  service_name: string;
  service_code: string;
  total_price: string; // cents string
  description: string;
  currency: string;
  min_delivery_date?: string;
  max_delivery_date?: string;
}

export async function POST(req: NextRequest) {
  let body: ShopifyRateRequest;
  try {
    body = (await req.json()) as ShopifyRateRequest;
  } catch {
    return NextResponse.json({ rates: [] });
  }

  const items = body.rate?.items ?? [];
  const dest = body.rate?.destination;

  // Toplam ağırlık (gram) — Shopify items'dan
  const totalGrams = items.reduce(
    (sum, it) => sum + (it.grams ?? 0) * (it.quantity ?? 1),
    0,
  );

  if (totalGrams <= 0) {
    // Ağırlık bilgisi yok — minimum rate dön
    return NextResponse.json({
      rates: [
        {
          service_name: 'Standart Kargo',
          service_code: 'KARGOLAB_DEFAULT',
          total_price: '5000', // 50 TL cents
          description: 'Ağırlık bilgisi eksik — varsayılan',
          currency: 'TRY',
        },
      ],
    });
  }

  // KargoLab'a sorgu — fromAddress varsayılan İstanbul/Kadıköy (deponuz)
  const quote = await quoteShipmentRate({
    weightGrams: totalGrams,
    fromProvince: process.env.WAREHOUSE_PROVINCE ?? 'İstanbul',
    fromDistrict: process.env.WAREHOUSE_DISTRICT ?? 'Kadıköy',
    toProvince: dest?.province ?? dest?.city ?? 'İstanbul',
    toDistrict: dest?.city ?? 'Kadıköy',
  });

  if (!quote.ok) {
    // KargoLab fail — basic fallback rate
    const kg = totalGrams / 1000;
    const fallback = Math.max(50, 30 + Math.round(kg * 50)); // TL
    return NextResponse.json({
      rates: [
        {
          service_name: 'Standart Kargo',
          service_code: 'KARGOLAB_FALLBACK',
          total_price: String(fallback * 100), // cents
          description: `Tahmini ${kg.toFixed(2)} kg`,
          currency: 'TRY',
        },
      ],
    });
  }

  // KargoLab dönen tüm kuryerleri Shopify rate formatına çevir
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 1);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 3);
  const iso = (d: Date) => d.toISOString().split('T')[0];

  const shopifyRates: ShopifyRate[] = quote.rates
    .sort((a: CourierRate, b: CourierRate) => a.priceCents - b.priceCents)
    .slice(0, 5) // ilk 5 en ucuz
    .map((r) => ({
      service_name: r.courrierName,
      service_code: `KARGOLAB_${r.courrierId}`,
      total_price: String(r.priceCents),
      description: r.acceptsCOD
        ? `${r.courrierName} · Kapıda ödeme kabul`
        : `${r.courrierName} · Hızlı teslimat`,
      currency: 'TRY',
      min_delivery_date: iso(minDate),
      max_delivery_date: iso(maxDate),
    }));

  return NextResponse.json({ rates: shopifyRates });
}

// Shopify CarrierService probe: GET request → 200 OK
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'kargolab-rates' });
}
