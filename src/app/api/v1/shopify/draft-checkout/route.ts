/**
 * POST /api/v1/shopify/draft-checkout
 *
 * Storefront → Sepet drawer'da müşteri adresi doldurur → "Ödemeye Geç" → bu endpoint çağrılır.
 *
 * Akış:
 *   1. Storefront cart token'i gönderir
 *   2. Biz Shopify Storefront API ile cart line items'ı okur
 *      (veya client cart attributes'i body'de gönderir — biz onu kullanırız)
 *   3. Shopify Admin API ile Draft Order yaratırız (shipping_address dahil)
 *   4. Shopify invoice_url döner — checkout pre-filled olarak açılır
 *   5. Müşteri sadece ödeme bilgisini girer
 *
 * CORS: storefront (via-mood.myshopify.com) → bu endpoint (Vendor Platform).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

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

interface DraftCheckoutBody {
  // Cart bilgisi
  line_items: Array<{ variant_id: number; quantity: number; properties?: Record<string, string> }>;
  // Shipping adresi
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address1: string;
  address2?: string;        // Mahalle
  city: string;             // İlçe
  province: string;         // İl
  zip?: string;
  country?: string;
  // Opsiyonel
  note?: string;
  attributes?: Record<string, string>;
}

interface DraftOrderResponse {
  draft_order: {
    id: number;
    invoice_url: string;
    status: string;
  };
}

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...corsHeaders(req.headers.get('origin')) };

  let body: DraftCheckoutBody;
  try {
    body = (await req.json()) as DraftCheckoutBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers });
  }

  // Validation
  const missing: string[] = [];
  if (!body.first_name?.trim()) missing.push('first_name');
  if (!body.last_name?.trim()) missing.push('last_name');
  if (!body.phone?.trim()) missing.push('phone');
  if (!body.email?.trim() || !body.email.includes('@')) missing.push('email');
  if (!body.address1?.trim()) missing.push('address1');
  if (!body.city?.trim()) missing.push('city');
  if (!body.province?.trim()) missing.push('province');
  if (!body.line_items?.length) missing.push('line_items');

  if (missing.length) {
    return NextResponse.json(
      { ok: false, error: 'missing_fields', missing },
      { status: 422, headers },
    );
  }

  const phone = body.phone.trim().replace(/\s/g, '');
  if (phone.length < 10) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 422, headers });
  }

  // Shopify Draft Order payload
  const shipping_address = {
    first_name: body.first_name.trim(),
    last_name: body.last_name.trim(),
    phone,
    address1: body.address1.trim(),
    address2: (body.address2 || '').trim(),
    city: body.city.trim(),
    province: body.province.trim(),
    zip: (body.zip || '').trim(),
    country: body.country?.trim() || 'Turkey',
  };

  // Cart attributes'tan _tr_billing_diff varsa farklı fatura adresi de hazırla
  const billingDiff = body.attributes?._tr_billing_diff === '1';
  const billing_address = billingDiff
    ? {
        first_name: body.attributes?._tr_billing_first_name || body.first_name,
        last_name: body.attributes?._tr_billing_last_name || body.last_name,
        phone: (body.attributes?._tr_billing_phone || phone).replace(/\s/g, ''),
        address1: body.attributes?._tr_billing_address1 || body.address1,
        address2: body.attributes?._tr_billing_mahalle || body.address2 || '',
        city: body.attributes?._tr_billing_ilce || body.city,
        province: body.attributes?._tr_billing_il || body.province,
        zip: body.attributes?._tr_billing_postal_code || body.zip || '',
        country: 'Turkey',
      }
    : shipping_address;

  const draftOrderPayload = {
    draft_order: {
      line_items: body.line_items.map((li) => ({
        variant_id: li.variant_id,
        quantity: li.quantity,
        properties: li.properties
          ? Object.entries(li.properties).map(([name, value]) => ({ name, value }))
          : undefined,
      })),
      shipping_address,
      billing_address,
      email: body.email.trim(),
      note: body.note || '',
      note_attributes: body.attributes
        ? Object.entries(body.attributes).map(([name, value]) => ({ name, value }))
        : undefined,
      use_customer_default_address: false,
      tags: 'via-mood-storefront',
    },
  };

  // Direct Shopify call (env-first; production deploy DB'den connection kullanır)
  const shopifyToken = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const shopifyDomain = env.SHOPIFY_STORE_DOMAIN;
  if (!shopifyToken) {
    return NextResponse.json(
      { ok: false, error: 'shopify_token_missing' },
      { status: 500, headers },
    );
  }

  try {
    const apiUrl = `https://${shopifyDomain}/admin/api/${env.SHOPIFY_API_VERSION}/draft_orders.json`;
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(draftOrderPayload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json(
        { ok: false, error: 'shopify_api_error', status: resp.status, detail: errText.slice(0, 500) },
        { status: 502, headers },
      );
    }

    const result = (await resp.json()) as DraftOrderResponse;
    if (!result.draft_order?.invoice_url) {
      return NextResponse.json(
        { ok: false, error: 'shopify_no_invoice_url', detail: result },
        { status: 502, headers },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        draft_order_id: result.draft_order.id,
        invoice_url: result.draft_order.invoice_url,
      },
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: 'fetch_error', detail: msg.slice(0, 500) },
      { status: 502, headers },
    );
  }
}
