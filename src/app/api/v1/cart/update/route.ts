/**
 * POST /api/v1/cart/update  { token, attributes?, note? }
 * Checkout alanlarını (adres/fatura/ödeme/kargo) sepete merge eder. FAZ 2 Dilim 4.
 * (Shopify `/cart/update.js` + `_tr_*` cart-attributes karşılığı.)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { cartCors, cartView, updateCart } from '@/lib/cart/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cartCors(req.headers.get('origin')) });
}

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...cartCors(req.headers.get('origin')) };
  let body: { token?: string; attributes?: Record<string, string>; note?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers });
  }
  if (!body.token) {
    return NextResponse.json({ ok: false, error: 'token gerekli' }, { status: 422, headers });
  }
  const cart = await updateCart(body.token, { attributes: body.attributes, note: body.note });
  return NextResponse.json({ ok: true, cart: await cartView(cart) }, { headers });
}
