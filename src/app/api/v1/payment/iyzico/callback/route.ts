/**
 * POST /api/v1/payment/iyzico/callback
 *
 * İyzico ödeme tamamlanınca buraya POST eder (token form-encoded).
 * Biz token ile ödeme durumunu retrieve eder:
 *   - SUCCESS → Shopify draft order'ı complete et (sipariş "ödendi") → teşekkür sayfası
 *   - FAILURE → hata sayfası
 *
 * Query: ?draft=<draft_order_id>
 */
import { NextResponse, type NextRequest } from 'next/server';
import { retrieveCheckoutForm } from '@/lib/iyzico/client';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STOREFRONT = env.STOREFRONT_URL;

async function completeDraftOrder(draftId: string): Promise<boolean> {
  const token = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token) return false;
  try {
    const url = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/draft_orders/${draftId}/complete.json`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      // payment_pending=false → sipariş "ödendi (paid)" olarak işaretlenir
      body: JSON.stringify({ payment_pending: false }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

function redirectHtml(url: string): NextResponse {
  // İyzico iframe içinden POST geldiği için top-level redirect JS ile yapılır
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Yönlendiriliyor…</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px">
<p>Ödeme sonucu işleniyor, yönlendiriliyorsunuz…</p>
<script>window.top.location.href = ${JSON.stringify(url)};</script>
</body></html>`;
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function POST(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get('draft') || '';

  let token = '';
  try {
    const form = await req.formData();
    token = String(form.get('token') || '');
  } catch {
    // bazı durumlarda JSON gelebilir
    try {
      const j = (await req.json()) as { token?: string };
      token = j.token || '';
    } catch {
      /* ignore */
    }
  }

  if (!token) {
    return redirectHtml(`${STOREFRONT}/pages/odeme-hata?reason=no_token`);
  }

  try {
    const result = await retrieveCheckoutForm(token);

    if (result.paymentStatus === 'SUCCESS') {
      // Shopify draft order'ı complete et
      if (draftId) {
        await completeDraftOrder(draftId);
      }
      const okUrl =
        `${STOREFRONT}/pages/siparis-alindi` +
        `?pid=${encodeURIComponent(result.paymentId || '')}` +
        (draftId ? `&order=${encodeURIComponent(draftId)}` : '');
      return redirectHtml(okUrl);
    }

    // Ödeme başarısız
    return redirectHtml(
      `${STOREFRONT}/pages/odeme-hata?reason=payment_failed&status=${encodeURIComponent(result.paymentStatus)}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return redirectHtml(`${STOREFRONT}/pages/odeme-hata?reason=${encodeURIComponent(msg.slice(0, 60))}`);
  }
}

// GET — bazı İyzico setup'larında callback GET gelebilir
export async function GET(req: NextRequest) {
  return POST(req);
}
