/**
 * GET /api/v1/payment/paytr/order-name?draft=<draftOrderId>
 *
 * Başarı sayfası (siparis-alindi) için: PayTR taslağı callback ile tamamlandıysa
 * GERÇEK Shopify sipariş adını (#1032) döner — müşteri e-postadaki numarayla
 * aynı numarayı görsün. Tamamlanmadıysa {completed:false} (sayfa poll eder).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getAllowedOrigins } from '@/lib/cors';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_ORIGIN = env.STOREFRONT_URL;
const ALLOWED = getAllowedOrigins();
function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED.includes(origin) ? origin : DEFAULT_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) });
}

export async function GET(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...cors(req.headers.get('origin')) };
  const draft = (req.nextUrl.searchParams.get('draft') ?? '').trim();
  if (!/^\d{5,20}$/.test(draft)) {
    return NextResponse.json({ ok: false, error: 'draft param geçersiz' }, { status: 422, headers });
  }
  const token = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ ok: false }, { status: 200, headers });

  try {
    const dRes = await fetch(
      `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/draft_orders/${draft}.json?fields=id,status,order_id`,
      { headers: { 'X-Shopify-Access-Token': token } },
    );
    if (!dRes.ok) return NextResponse.json({ ok: true, completed: false }, { status: 200, headers });
    const dj = (await dRes.json()) as { draft_order?: { order_id?: number | null } };
    const orderId = dj.draft_order?.order_id;
    if (!orderId) return NextResponse.json({ ok: true, completed: false }, { status: 200, headers });

    const oRes = await fetch(
      `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/orders/${orderId}.json?fields=name,financial_status,order_status_url,total_price,line_items`,
      { headers: { 'X-Shopify-Access-Token': token } },
    );
    if (!oRes.ok) return NextResponse.json({ ok: true, completed: false }, { status: 200, headers });
    const oj = (await oRes.json()) as {
      order?: {
        name?: string;
        order_status_url?: string;
        total_price?: string;
        line_items?: Array<{ title?: string; quantity?: number; price?: string }>;
      };
    };
    const o = oj.order;
    if (!o?.name) return NextResponse.json({ ok: true, completed: false }, { status: 200, headers });
    return NextResponse.json(
      {
        ok: true,
        completed: true,
        name: o.name,
        // Üyeliksiz sipariş takibi: Shopify'ın token'lı public durum sayfası
        status_url: o.order_status_url ?? null,
        total: o.total_price ?? null,
        items: (o.line_items ?? []).slice(0, 20).map((li) => ({
          title: li.title ?? '',
          qty: li.quantity ?? 1,
          price: li.price ?? '',
        })),
      },
      { status: 200, headers },
    );
  } catch {
    return NextResponse.json({ ok: true, completed: false }, { status: 200, headers });
  }
}
