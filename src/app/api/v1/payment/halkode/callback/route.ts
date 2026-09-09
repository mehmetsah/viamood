/**
 * GET|POST /api/v1/payment/halkode/callback   (Halköde return_url / cancel_url)
 *
 * Halköde 3D bitince TARAYICIYI buraya yönlendirir (query string ile; ölçüldü:
 * son adım `window.location.href = "<return_url>?order_no=…&hash_key=…"`).
 *
 * GÜVENLİK — üç kat, sırayla:
 *   1) hash_key ÇÖZÜLÜR (app_secret ile AES). Çözülmüyorsa → sahte/kurcalanmış, RED.
 *   2) hash içindeki invoice_id URL'deki invoice_id ile AYNI olmalı.
 *   3) SONUCA URL'DEKİ status_code'a BAKARAK KARAR VERİLMEZ — sunucu-sunucu
 *      /api/checkstatus çağrılır. Sipariş yalnız ORADAN "Completed" gelirse ödendi
 *      sayılır. (URL parametreleri istemciden geçtiği için tek başına delil değildir;
 *      hash da tutarı taşıdığı için tutar ayrıca checkstatus ile karşılaştırılır.)
 *
 * Başarılıysa: invoice_id'ye gömülü draft/pending sipariş complete edilir
 * (native → RDS paid+komisyon, aksi → Shopify draft complete) — PayTR callback'iyle
 * aynı davranış, aynı idempotanlık.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { getStore } from '@/lib/store';
import { completeNativeCardOrder } from '@/lib/store/native-create-order';
import {
  getToken,
  checkStatus,
  decodeHashKey,
  parseDraftIdFromInvoiceId,
  halkodeConfigured,
  halkodeAppSecret,
  HALKODE_STATUS,
} from '@/lib/halkode/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STOREFRONT = env.STOREFRONT_URL;

function redirect(url: string): NextResponse {
  return NextResponse.redirect(url, { status: 303 });
}
function failPage(reason: string, invoiceId?: string): NextResponse {
  const q = new URLSearchParams({ reason: `halkode:${reason}` });
  if (invoiceId) q.set('ref', invoiceId);
  return redirect(`${STOREFRONT}/pages/odeme-hata?${q.toString()}`);
}

async function completeDraftOrder(draftId: string): Promise<boolean> {
  const token = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token) return false;
  try {
    const resp = await fetch(
      `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/draft_orders/${draftId}/complete.json`,
      {
        method: 'PUT',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_pending: false }), // ödendi
      },
    );
    return resp.ok;
  } catch {
    return false;
  }
}

/** Halköde hem GET (query) hem POST (form) ile dönebilir — ikisini de aynı yerde topla. */
async function collectParams(req: NextRequest): Promise<Record<string, string>> {
  const p: Record<string, string> = {};
  for (const [k, v] of new URL(req.url).searchParams) p[k] = v;
  if (req.method === 'POST') {
    try {
      const form = await req.formData();
      for (const [k, v] of form.entries()) p[k] = String(v);
    } catch {
      /* gövde yoksa query yeterli */
    }
  }
  return p;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!(await halkodeConfigured())) return failPage('not_configured');

  const p = await collectParams(req);
  const invoiceId = p.invoice_id || '';
  const hashKey = p.hash_key || '';

  if (!invoiceId || !hashKey) {
    console.error('[halkode/callback] eksik parametre', { hasInvoice: !!invoiceId, hasHash: !!hashKey });
    return failPage('missing_params', invoiceId);
  }

  // 1+2) İMZA — çözülüyor mu, invoice tutuyor mu
  // app_secret ayarlardan (yoksa env) — initialize ile AYNI kaynak olmalı, yoksa
  // imza hiçbir zaman tutmaz ve her ödeme 'bad_signature' ile düşer.
  const parts = decodeHashKey(hashKey, await halkodeAppSecret());
  if (!parts) {
    console.error('[halkode/callback] hash ÇÖZÜLEMEDİ — işlenmedi', { invoiceId });
    return failPage('bad_signature', invoiceId);
  }
  if (parts.invoiceId !== invoiceId) {
    console.error('[halkode/callback] hash invoice_id uyuşmuyor — işlenmedi', {
      invoiceId,
      hashInvoiceId: parts.invoiceId,
    });
    return failPage('invoice_mismatch', invoiceId);
  }

  // 3) SUNUCU-SUNUCU doğrulama — tek güven kaynağı
  const t = await getToken();
  if (!t.ok) {
    console.error('[halkode/callback] token alınamadı, sipariş TAMAMLANMADI', { invoiceId, error: t.error });
    return failPage('token_failed', invoiceId);
  }
  const st = await checkStatus(invoiceId, t.token);

  if (!st.ok) {
    console.log('[halkode/callback] ödeme başarısız', {
      invoiceId,
      statusCode: st.statusCode,
      description: st.description,
      urlStatusCode: p.status_code, // teşhis: URL ne diyordu
      mdStatus: p.md_status,
      bankError: p.original_bank_error_code,
    });
    const reason = st.statusCode === HALKODE_STATUS.ORDER_OR_PAYMENT_FAILED ? 'declined' : `status_${st.statusCode}`;
    return failPage(reason, invoiceId);
  }

  // Tutar tutarlılığı: hash'teki tutar ile checkstatus'un tutarı aynı mı (kuruş bazında)
  const hashKurus = Math.round(parseFloat(parts.total) * 100);
  const apiKurus = Math.round(parseFloat(String(st.data.transaction_amount ?? st.data.product_price ?? '0')) * 100);
  if (Number.isFinite(hashKurus) && Number.isFinite(apiKurus) && apiKurus > 0 && hashKurus !== apiKurus) {
    console.error('[halkode/callback] TUTAR UYUŞMAZLIĞI — sipariş tamamlanmadı', { invoiceId, hashKurus, apiKurus });
    return failPage('amount_mismatch', invoiceId);
  }

  // Ödeme kesin → siparişi tamamla (idempotent)
  const draftId = parseDraftIdFromInvoiceId(invoiceId);
  if (draftId) {
    try {
      if ((await getStore()).backend === 'native') {
        await completeNativeCardOrder(draftId);
        console.log('[halkode/callback] native sipariş tamamlandı', { invoiceId, draftId });
      } else {
        const done = await completeDraftOrder(draftId);
        if (done) console.log('[halkode/callback] Shopify draft complete', { invoiceId, draftId });
        else console.error('[halkode/callback] draft complete BAŞARISIZ', { invoiceId, draftId });
      }
    } catch (e) {
      console.error('[halkode/callback] tamamlama hatası', { invoiceId, draftId, e: String(e) });
    }
  } else {
    console.error('[halkode/callback] ödeme başarılı ama draftId yok', { invoiceId });
  }

  const q = new URLSearchParams({ ref: invoiceId });
  if (draftId) q.set('order', draftId);
  return redirect(`${STOREFRONT}/pages/siparis-alindi?${q.toString()}`);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
