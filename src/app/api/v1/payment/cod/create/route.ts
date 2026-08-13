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
import { getAllowedOrigins } from '@/lib/cors';
import { env } from '@/lib/env';
import { getStore, type StorefrontOrderBody } from '@/lib/store';
import { trustedDiscountTl } from '@/lib/shopify/discount-resolve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_ORIGIN = env.STOREFRONT_URL;
const ALLOWED_ORIGINS = getAllowedOrigins();

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

  // Kapıda ödeme KAPALI (COD_ENABLED, varsayılan false). Tema checkout'unda seçenek zaten
  // gizli; bu kapı önbellekten gelen eski sayfa / doğrudan POST ile COD siparişi açılmasını da
  // engeller. Mevcut açık COD siparişleri etkilenmez — burası yalnız YENİ sipariş yolu.
  if (!env.COD_ENABLED) {
    return NextResponse.json(
      { ok: false, error: 'cod_disabled', detail: 'Kapıda ödeme şu anda kullanılamıyor. Lütfen kart veya havale/EFT ile ödeyin.' },
      { status: 403, headers },
    );
  }

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

  // İNDİRİM SUNUCUDA YENİDEN HESAPLANIR — istemciden gelen tutara GÜVENİLMEZ.
  // (11 Ağu 2026 açığı: kapsam okunmadığı için tek ürüne tanımlı kupon tüm sepete
  //  uygulanıp toplamı sıfırlıyordu.) Kupon ürün-bazlıysa yalnız hak eden satırlara,
  //  o satırların tutarıyla sınırlı uygulanır; hak eden yoksa 0.
  body.discount_amount = await trustedDiscountTl(body.discount_code, body.line_items ?? [], {
    email: body.customer_email || body.email,
    phone: body.phone,
    customerId: body.customer_id,
  });

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
