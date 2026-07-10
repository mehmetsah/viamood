/**
 * POST /api/v1/payment/cod/create
 *
 * Storefront custom checkout → Kapıda Ödeme (COD) siparişi.
 * Shopify'da "pending" (tahsilat bekliyor) gerçek sipariş açar, sipariş kodunu döndürür.
 *
 * Sipariş `kapida-odeme,tahsilatli-kargo` etiketli + `_kapida_odeme=1` note_attribute'lu
 * oluşur. Shipment oluşturulurken (lib/kargolab/shipments.ts) bu işaret okunup
 * `payment_at_door = sipariş toplamı` set edilir → kurye kapıda tahsil eder.
 * Tahsil olana dek hak ediş/ledger'da görünmez (COD settlement modeli).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { getStore, type StorefrontOrderBody } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_ORIGIN = env.STOREFRONT_URL;
const ALLOWED_ORIGINS = [
  DEFAULT_ORIGIN,
  'https://d3z34m-iw.myshopify.com',
  'https://viamood.com',
  'https://www.viamood.com',
  'https://viamood.com.tr',
  'https://www.viamood.com.tr',
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : DEFAULT_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...corsHeaders(req.headers.get('origin')) };

  let body: StorefrontOrderBody;
  try {
    body = (await req.json()) as StorefrontOrderBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers });
  }

  const missing: string[] = [];
  if (!body.first_name?.trim()) missing.push('first_name');
  if (!body.last_name?.trim()) missing.push('last_name');
  if (!body.phone?.trim()) missing.push('phone');
  if (!body.email?.includes('@')) missing.push('email');
  if (!body.address1?.trim()) missing.push('address1');
  if (!body.city?.trim()) missing.push('city');
  if (!body.province?.trim()) missing.push('province');
  if (!body.line_items?.length) missing.push('line_items');
  if (missing.length) {
    return NextResponse.json({ ok: false, error: 'missing_fields', missing }, { status: 422, headers });
  }

  const created = await (await getStore()).createStorefrontOrder(body, 'cod');
  if (!created.ok) {
    return NextResponse.json(
      { ok: false, error: 'order_create_failed', detail: created.error },
      { status: 502, headers },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      order_code: created.orderName,
      order_name: created.orderName,
      email: body.customer_email || body.email, // takip linki siparişin GERÇEK e-postasıyla kurulsun
      order_id: created.orderId,
      total: created.total,
    },
    { status: 200, headers },
  );
}
