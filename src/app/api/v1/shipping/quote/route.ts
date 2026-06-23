/**
 * POST /api/v1/shipping/quote
 *
 * Storefront sepetten: alıcı il/ilçe + toplam ağırlık (gram) → KargoLab member-price-check
 * → en ucuz kuryer fiyatı (+ Via Mood margin). Sepette "Tahmini Kargo" gösterimi için.
 *
 * Margin: KargoLab maliyetinin üzerine sabit kar payı eklenir (admin ayarı).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { quoteShipmentRate } from '@/lib/kargolab/rates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_ORIGIN = env.STOREFRONT_URL;
const ALLOWED = [
  DEFAULT_ORIGIN,
  'https://d3z34m-iw.myshopify.com',
  'https://viamood.com',
  'https://www.viamood.com',
  'https://viamood.com.tr',
  'https://www.viamood.com.tr',
];

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED.includes(origin) ? origin : DEFAULT_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) });
}

interface QuoteBody {
  province: string; // İl (alıcı)
  district?: string; // İlçe
  weight_grams?: number; // sepet toplam ağırlık
  item_count?: number;
}

// Via Mood kargo kar payı (TL) — KargoLab maliyeti üzerine eklenir
const SHIPPING_MARGIN_TL = 20;
// Min/fallback kargo (KargoLab başarısızsa)
const FALLBACK_SHIPPING_TL = 95;

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...cors(req.headers.get('origin')) };

  let body: QuoteBody;
  try {
    body = (await req.json()) as QuoteBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers });
  }

  if (!body.province?.trim()) {
    return NextResponse.json({ ok: false, error: 'province_required' }, { status: 422, headers });
  }

  // Ağırlık: gönderilen veya min 1kg (ürün başına ~500g varsay)
  const weightGrams = Math.max(body.weight_grams || (body.item_count || 1) * 500, 1000);

  try {
    const result = await quoteShipmentRate({
      weightGrams,
      toProvince: body.province.trim(),
      toDistrict: body.district?.trim(),
      // Gönderen: Via Mood merkez (İstanbul / Beyoğlu — env'den de gelebilir)
      fromProvince: 'İstanbul',
      fromDistrict: 'Beyoğlu',
    });

    if (!result.ok) {
      // KargoLab başarısız → fallback sabit ücret
      return NextResponse.json(
        {
          ok: true,
          shipping_tl: FALLBACK_SHIPPING_TL,
          courier: 'Standart Kargo',
          source: 'fallback',
          note: result.error,
        },
        { status: 200, headers },
      );
    }

    const cheapestTl = result.cheapest.priceCents / 100;
    const finalTl = Math.ceil(cheapestTl + SHIPPING_MARGIN_TL);

    return NextResponse.json(
      {
        ok: true,
        shipping_tl: finalTl,
        courier: result.cheapest.courrierName,
        cost_tl: cheapestTl,
        margin_tl: SHIPPING_MARGIN_TL,
        accepts_cod: result.cheapest.acceptsCOD,
        all_rates: result.rates.map((r) => ({
          courier: r.courrierName,
          price_tl: Math.ceil(r.priceCents / 100 + SHIPPING_MARGIN_TL),
          accepts_cod: r.acceptsCOD,
          accepts_cod_card: r.acceptsCODCard,
        })),
        source: result.cached ? 'cache' : 'kargolab',
      },
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: true, shipping_tl: FALLBACK_SHIPPING_TL, courier: 'Standart Kargo', source: 'error', note: msg.slice(0, 120) },
      { status: 200, headers },
    );
  }
}
