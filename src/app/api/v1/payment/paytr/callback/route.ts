/**
 * POST /api/v1/payment/paytr/callback   (PayTR "Bildirim URL")
 *
 * PayTR ödeme sonucunu server-to-server form-encoded POST eder.
 * Hash doğrulanır (merchant_oid+merchant_salt+status+total_amount). Geçerliyse:
 *   - status=success → merchant_oid'deki draft order id'si complete edilir (sipariş = ödendi)
 *   - her geçerli bildirimde DÜZ "OK" döner (yoksa PayTR tekrar tekrar dener)
 *
 * Bu URL PayTR mağaza panelinde "Bildirim URL" olarak ayarlanır.
 * Browser yönlendirmesi AYRI (merchant_ok_url / merchant_fail_url, initialize'da set edilir).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { verifyPaytrCallback, parseDraftIdFromOid } from '@/lib/paytr/client';
import { getStore } from '@/lib/store';
import { completeNativeCardOrder } from '@/lib/store/native-create-order';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function completeDraftOrder(draftId: string): Promise<boolean> {
  const token = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token) return false;
  try {
    const url = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/draft_orders/${draftId}/complete.json`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_pending: false }), // ödendi (paid)
    });
    return resp.ok;
  } catch {
    return false;
  }
}

function okText(): NextResponse {
  return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export async function POST(req: NextRequest) {
  const p: Record<string, string> = {};
  try {
    const form = await req.formData();
    for (const [k, v] of form.entries()) p[k] = String(v);
  } catch {
    return new NextResponse('bad request', { status: 400 });
  }

  const merchantOid = p.merchant_oid || '';
  const status = p.status || '';
  const totalAmount = p.total_amount || '';
  const hash = p.hash || '';

  if (!verifyPaytrCallback(merchantOid, status, totalAmount, hash)) {
    // Hash tutmuyor → işleme alma (sahtecilik koruması). PayTR yeniden deneyebilir.
    return new NextResponse('PAYTR notification failed: bad hash', { status: 400 });
  }

  // Hash geçerli → her durumda OK dön (PayTR retry döngüsü dursun).
  if (status === 'success') {
    const draftId = parseDraftIdFromOid(merchantOid);
    if (draftId) {
      // native → RDS paid+komisyon; aksi → Shopify draft complete (ikisi de idempotent)
      if ((await getStore()).backend === 'native') await completeNativeCardOrder(draftId);
      else await completeDraftOrder(draftId);
    }
  }
  return okText();
}

// PayTR bazı durumlarda test amaçlı GET atabilir
export async function GET() {
  return okText();
}
