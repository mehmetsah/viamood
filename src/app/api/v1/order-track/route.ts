/**
 * POST /api/v1/order-track — HALKA AÇIK sipariş takibi (üyelik gerektirmez).
 *
 * body: { order: "#1033" | "1033", email: "..." }
 * Sipariş no + e-posta EŞLEŞİRSE minimal durum döner:
 *   { ok, name, placed_at, financial_status, status_text, fulfillments: [{carrier, tracking_number, tracking_url}] }
 * Eşleşmezse 404 (hangi alanın yanlış olduğu söylenmez — enumeration koruması).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { fulfillments, orders } from '@/db/schema';
import { env } from '@/lib/env';

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

function statusText(financial: string | null, hasTracking: boolean, cancelled: boolean): string {
  if (cancelled) return 'İptal edildi';
  if (hasTracking) return 'Kargoya verildi';
  if (financial === 'paid' || financial === 'partially_paid') return 'Hazırlanıyor';
  return 'Ödeme bekleniyor';
}

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...cors(req.headers.get('origin')) };

  let body: { order?: string; email?: string };
  try {
    body = (await req.json()) as { order?: string; email?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers });
  }
  const rawOrder = String(body.order ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!rawOrder || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'order_ve_email_gerekli' }, { status: 422, headers });
  }
  const name = rawOrder.startsWith('#') ? rawOrder : `#${rawOrder}`;

  const [o] = await db
    .select({
      id: orders.id,
      name: orders.shopifyOrderName,
      orderNumber: orders.orderNumber,
      email: orders.customerEmail,
      financialStatus: orders.financialStatus,
      cancelledAt: orders.cancelledAt,
      placedAt: orders.placedAt,
    })
    .from(orders)
    .where(
      and(
        or(eq(orders.shopifyOrderName, name), eq(orders.orderNumber, rawOrder)),
        eq(orders.customerEmail, email),
      ),
    )
    .limit(1);

  if (!o) {
    // e-posta büyük/küçük farkı için ikinci şans: sadece isimle bul, e-postayı elle karşılaştır
    const [o2] = await db
      .select({
        id: orders.id,
        name: orders.shopifyOrderName,
        orderNumber: orders.orderNumber,
        email: orders.customerEmail,
        financialStatus: orders.financialStatus,
        cancelledAt: orders.cancelledAt,
        placedAt: orders.placedAt,
      })
      .from(orders)
      .where(or(eq(orders.shopifyOrderName, name), eq(orders.orderNumber, rawOrder)))
      .limit(1);
    if (!o2 || (o2.email ?? '').toLowerCase() !== email) {
      return NextResponse.json({ ok: false, error: 'bulunamadi' }, { status: 404, headers });
    }
    return NextResponse.json(await buildResponse(o2), { status: 200, headers });
  }
  return NextResponse.json(await buildResponse(o), { status: 200, headers });
}

async function buildResponse(o: {
  id: string;
  name: string | null;
  orderNumber: string | null;
  financialStatus: string | null;
  cancelledAt: Date | null;
  placedAt: Date;
}) {
  const fuls = await db
    .select({
      carrier: fulfillments.carrier,
      trackingNumber: fulfillments.trackingNumber,
      trackingUrl: fulfillments.trackingUrl,
    })
    .from(fulfillments)
    .where(eq(fulfillments.orderId, o.id));
  const withTracking = fuls.filter((f) => f.trackingNumber);
  return {
    ok: true,
    name: o.name ?? o.orderNumber ?? '',
    placed_at: o.placedAt.toISOString(),
    financial_status: o.financialStatus,
    status_text: statusText(o.financialStatus, withTracking.length > 0, !!o.cancelledAt),
    fulfillments: withTracking.map((f) => ({
      carrier: f.carrier,
      tracking_number: f.trackingNumber,
      tracking_url: f.trackingUrl,
    })),
  };
}
