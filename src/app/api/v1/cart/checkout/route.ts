/**
 * POST /api/v1/cart/checkout  { token, payment_method: 'havale'|'cod' }
 * Native sepeti siparişe dönüştürür (havale/COD anında oluşur). Kart DEĞİL — kart için
 * /api/v1/payment/{iyzico,paytr}/initialize kullanılır. FAZ 2 Dilim 4.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { cartCors, checkoutCart } from '@/lib/cart/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cartCors(req.headers.get('origin')) });
}

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...cartCors(req.headers.get('origin')) };
  let body: { token?: string; payment_method?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers });
  }
  if (!body.token) {
    return NextResponse.json({ ok: false, error: 'token gerekli' }, { status: 422, headers });
  }
  if (body.payment_method !== 'havale' && body.payment_method !== 'cod') {
    return NextResponse.json(
      { ok: false, error: 'payment_method havale|cod olmalı (kart için payment/*/initialize)' },
      { status: 422, headers },
    );
  }
  const result = await checkoutCart(body.token, body.payment_method);
  return NextResponse.json(result, { status: result.ok ? 200 : 502, headers });
}
