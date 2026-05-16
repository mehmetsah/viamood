import { NextResponse, type NextRequest } from 'next/server';
import { mikroHealthCheck } from '@/lib/mikro/client';
import { syncOrderToMikro } from '@/lib/server/mikro-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DEV / admin endpoint — manuel Mikro sync.
 *   POST { orderId } → tek bir order'ı pipeline'a sok
 *   POST { health: true } → sadece Mikro login testi
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development' && !process.env.MIKRO_DEV_ALLOW) {
    return NextResponse.json({ error: 'dev only' }, { status: 403 });
  }
  const body = (await req.json()) as { orderId?: string; health?: boolean };

  if (body.health) {
    return NextResponse.json(await mikroHealthCheck());
  }
  if (!body.orderId) {
    return NextResponse.json({ error: 'orderId or health required' }, { status: 400 });
  }
  return NextResponse.json(await syncOrderToMikro(body.orderId));
}
