/**
 * GET /api/v1/cart?token=<token>   — native sepeti döner (yoksa yeni token üretir).
 * FAZ 2 Dilim 4 backend. Tema henüz kullanmıyor.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { cartCors, cartView, getOrCreateCart } from '@/lib/cart/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cartCors(req.headers.get('origin')) });
}

export async function GET(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...cartCors(req.headers.get('origin')) };
  const token = req.nextUrl.searchParams.get('token');
  const cart = await getOrCreateCart(token);
  return NextResponse.json({ ok: true, cart: await cartView(cart) }, { headers });
}
