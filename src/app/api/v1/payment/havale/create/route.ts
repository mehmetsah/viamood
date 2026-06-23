/**
 * POST /api/v1/payment/havale/create
 *
 * Storefront custom checkout → Havale/EFT siparişi.
 * Shopify'da "pending" (ödenmemiş) gerçek sipariş açar, sipariş kodunu (order.name)
 * ve sepetteki tedarikçi(ler)in IBAN bilgilerini döndürür.
 *
 * Per-vendor model: müşteri her tedarikçinin kendi IBAN'ına havale yapar; tedarikçi
 * (Via Mood ürünü ise admin) ödemeyi görünce AWS panelinden onaylar → sipariş ilerler.
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  createStorefrontOrder,
  type StorefrontOrderBody,
} from '@/lib/shopify/create-storefront-order';
import { resolveVendorIbans } from '@/lib/shopify/vendor-ibans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_ORIGIN = 'https://via-mood.myshopify.com';
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

  // Tedarikçi IBAN'larını çöz (sipariş oluşturmadan önce — hata olsa bile bilgi gösterilir)
  let vendors: Awaited<ReturnType<typeof resolveVendorIbans>> = [];
  try {
    vendors = await resolveVendorIbans(body.line_items, body.shipping_cost ?? 0);
  } catch (e) {
    console.error('[havale] vendor iban resolve hatası:', e);
  }

  // Shopify pending sipariş oluştur
  const created = await createStorefrontOrder(body, 'havale');
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
      order_id: created.orderId,
      total: created.total,
      vendors,
    },
    { status: 200, headers },
  );
}
