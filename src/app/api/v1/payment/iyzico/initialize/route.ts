/**
 * POST /api/v1/payment/iyzico/initialize
 *
 * Storefront → sepet adresi + line items gönderir.
 * Biz İyzico CheckoutForm token + iframe HTML döneriz.
 * Müşteri İyzico iframe'inde kart girer (PCI yükü İyzico'da).
 *
 * Ödeme sonrası İyzico → /api/v1/payment/iyzico/callback POST'lar.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { initializeCheckoutForm } from '@/lib/iyzico/client';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ORIGINS = [
  'https://via-mood.myshopify.com',
  'https://d3z34m-iw.myshopify.com',
  'https://viamood.com',
  'https://www.viamood.com',
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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

interface InitBody {
  line_items: Array<{ variant_id: number; quantity: number; title?: string; price?: number; product_type?: string }>;
  shipping_cost?: number; // kuruş veya TL? — TL kabul ediyoruz (number)
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address1: string;
  address2?: string;
  city: string; // İlçe
  province: string; // İl
  zip?: string;
  identity_number?: string;
  draft_order_id?: number; // Shopify draft order id (callback'te complete için)
}

function toMoney(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...corsHeaders(req.headers.get('origin')) };

  let body: InitBody;
  try {
    body = (await req.json()) as InitBody;
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

  // Fiyat hesabı (TL)
  let itemsTotal = 0;
  const basketItems = body.line_items.map((li, i) => {
    const unit = (li.price ?? 0) / 100; // Shopify price kuruş cinsinden gelir
    const lineTotal = unit * li.quantity;
    itemsTotal += lineTotal;
    return {
      id: String(li.variant_id || `item-${i}`),
      name: (li.title || 'Ürün').slice(0, 200),
      category: li.product_type || 'Genel',
      price: toMoney(lineTotal),
    };
  });

  const shipping = body.shipping_cost ?? 0;
  const paidTotal = itemsTotal + shipping;

  // Kargo'yu basket'e ayrı item olarak ekle ki price === sum(basketItems)
  if (shipping > 0) {
    basketItems.push({
      id: 'shipping',
      name: 'Kargo',
      category: 'Kargo',
      price: toMoney(shipping),
    });
  }

  const phone = body.phone.replace(/\s/g, '');
  const gsm = phone.startsWith('+') ? phone : `+90${phone.replace(/^0/, '')}`;
  const fullAddr = `${body.address1}${body.address2 ? ', ' + body.address2 : ''}, ${body.city}/${body.province}`;
  const conversationId = `vm-${Date.now()}-${Math.floor(itemsTotal)}`;

  // Callback URL — draft_order_id'yi query'de taşı
  const callbackUrl =
    `${env.IYZICO_CALLBACK_BASE}/api/v1/payment/iyzico/callback` +
    (body.draft_order_id ? `?draft=${body.draft_order_id}` : '');

  const addr = {
    contactName: `${body.first_name} ${body.last_name}`,
    city: body.province,
    country: 'Türkiye',
    address: fullAddr,
    zipCode: body.zip || '34000',
  };

  try {
    const result = await initializeCheckoutForm({
      conversationId,
      price: toMoney(itemsTotal + shipping), // basket toplamı (kargo dahil item olarak eklendi)
      paidPrice: toMoney(paidTotal),
      callbackUrl,
      buyer: {
        id: body.email,
        name: body.first_name,
        surname: body.last_name,
        gsmNumber: gsm,
        email: body.email,
        identityNumber: body.identity_number || '11111111111',
        registrationAddress: fullAddr,
        city: body.province,
        country: 'Türkiye',
        zipCode: body.zip || '34000',
      },
      shippingAddress: addr,
      billingAddress: addr,
      basketItems,
    });

    return NextResponse.json(
      {
        ok: true,
        token: result.token,
        checkoutFormContent: result.checkoutFormContent,
        paymentPageUrl: result.paymentPageUrl,
        conversationId,
      },
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: 'iyzico_init_error', detail: msg.slice(0, 500) },
      { status: 502, headers },
    );
  }
}
