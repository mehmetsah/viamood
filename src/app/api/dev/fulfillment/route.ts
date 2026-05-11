import { NextResponse, type NextRequest } from 'next/server';
import { createFulfillmentForOrderVendor } from '@/lib/server/fulfillment-service';

/**
 * DEV-only endpoint — KargoLab fulfillment'ı dışarıdan tetikleyebilmek için.
 * Production'da NODE_ENV check ile kapatılır.
 *
 * Usage:
 *   curl -X POST 'http://localhost:3000/api/_dev/fulfillment' \
 *     -H 'Content-Type: application/json' \
 *     -d '{"orderId":"...","vendorId":"...","courrier":"PTT"}'
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 });
  }
  const body = (await req.json()) as {
    orderId?: string;
    vendorId?: string;
    courrier?: 'PTT' | 'ARAS' | 'MNG' | 'YURTICI' | 'SURAT';
  };
  if (!body.orderId || !body.vendorId) {
    return NextResponse.json({ error: 'orderId ve vendorId gerekli' }, { status: 400 });
  }
  const result = await createFulfillmentForOrderVendor(body.orderId, body.vendorId, {
    courrier: body.courrier ?? 'PTT',
  });
  return NextResponse.json(result);
}
