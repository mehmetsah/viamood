/**
 * POST /api/v1/cart/change  { token, variant_id, quantity }
 * Satır adedini günceller (quantity=0 → satırı kaldırır). FAZ 2 Dilim 4.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { cartCors, cartView, changeItem } from '@/lib/cart/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cartCors(req.headers.get('origin')) });
}

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...cartCors(req.headers.get('origin')) };
  let body: { token?: string; variant_id?: string | number; quantity?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers });
  }
  if (!body.token || body.variant_id == null || body.quantity == null) {
    return NextResponse.json({ ok: false, error: 'token, variant_id, quantity gerekli' }, { status: 422, headers });
  }
  const cart = await changeItem(body.token, String(body.variant_id), body.quantity);
  return NextResponse.json({ ok: true, cart: await cartView(cart) }, { headers });
}
