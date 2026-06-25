/**
 * POST /api/v1/cart/add  { token?, variant_id, quantity?, customer_id? }
 * Sepete ürün ekler (varsa adedi artırır). Token yoksa yeni sepet açar. FAZ 2 Dilim 4.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { addItem, cartCors, cartView } from '@/lib/cart/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cartCors(req.headers.get('origin')) });
}

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...cartCors(req.headers.get('origin')) };
  let body: { token?: string; variant_id?: string | number; quantity?: number; customer_id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers });
  }
  if (body.variant_id == null || String(body.variant_id).trim() === '') {
    return NextResponse.json({ ok: false, error: 'variant_id gerekli' }, { status: 422, headers });
  }
  const cart = await addItem(body.token, String(body.variant_id), body.quantity ?? 1, body.customer_id ?? null);
  return NextResponse.json({ ok: true, cart: await cartView(cart) }, { headers });
}
