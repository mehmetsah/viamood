import { NextResponse, type NextRequest } from 'next/server';
import {
  accrueCommissionForOrder,
  approvePayout,
  createPayoutBatch,
  markPayoutPaid,
} from '@/lib/server/commission-service';
import { markOrderPaid } from '@/lib/orders/lifecycle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 });
  }
  const body = (await req.json()) as {
    op: 'accrue' | 'create_payout' | 'approve' | 'mark_paid' | 'pay_order';
    orderId?: string;
    vendorId?: string;
    payoutId?: string;
    periodStart?: string;
    periodEnd?: string;
    method?: 'iyzico_split' | 'iyzico_transfer' | 'manual_bank' | 'paytr_bk';
    approvedByUserId?: string;
    externalReference?: string;
  };

  const safeJson = (data: unknown) =>
    JSON.parse(
      JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
    );

  switch (body.op) {
    case 'accrue':
      if (!body.orderId) return NextResponse.json({ error: 'orderId yok' }, { status: 400 });
      return NextResponse.json(safeJson(await accrueCommissionForOrder(body.orderId)));
    case 'pay_order':
      if (!body.orderId) return NextResponse.json({ error: 'orderId yok' }, { status: 400 });
      return NextResponse.json(safeJson(await markOrderPaid(body.orderId)));
    case 'create_payout':
      if (!body.vendorId || !body.periodStart || !body.periodEnd) {
        return NextResponse.json({ error: 'vendorId/periodStart/periodEnd' }, { status: 400 });
      }
      return NextResponse.json(
        safeJson(
          await createPayoutBatch(
            body.vendorId,
            new Date(body.periodStart),
            new Date(body.periodEnd),
            body.method ?? 'manual_bank',
          ),
        ),
      );
    case 'approve':
      if (!body.payoutId || !body.approvedByUserId) {
        return NextResponse.json({ error: 'payoutId/approvedByUserId' }, { status: 400 });
      }
      return NextResponse.json(
        safeJson(await approvePayout(body.payoutId, body.approvedByUserId)),
      );
    case 'mark_paid':
      if (!body.payoutId) {
        return NextResponse.json({ error: 'payoutId' }, { status: 400 });
      }
      return NextResponse.json(
        safeJson(await markPayoutPaid(body.payoutId, body.externalReference)),
      );
    default:
      return NextResponse.json({ error: 'op desteklenmiyor' }, { status: 400 });
  }
}
