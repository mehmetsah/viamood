/**
 * POST /api/v1/payment/halkode/installments
 *
 * Checkout'ta müşteri kart numarasının ilk 6 hanesini girer girmez çağrılır;
 * karta tanımlı taksit seçeneklerini döner. Ödeme ekranındaki taksit tablosu
 * bundan basılır.
 *
 * İstek : { bin: "415565", amount: 1250.50 }
 * Yanıt : { ok: true, installments: [{ installments_number, amount_to_be_paid,
 *           payable_amount, card_program, card_scheme, card_type, pos_id, title }] }
 *
 * ⚠️ Halköde'nin `hash_key` alanı yanıttan ÇIKARILIR — istemciye gitmesine gerek yok.
 * ⚠️ Bu uç yalnızca BIN (ilk 6 hane) alır; tam kart numarası KABUL EDİLMEZ.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getAllowedOrigins } from '@/lib/cors';
import { env } from '@/lib/env';
import { getToken, getPos, halkodeConfigured, halkodeEnabled } from '@/lib/halkode/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = getAllowedOrigins();
function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED.includes(origin) ? origin : env.STOREFRONT_URL;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) });
}

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...cors(req.headers.get('origin')) };

  if (!halkodeEnabled() || !halkodeConfigured()) {
    return NextResponse.json({ ok: false, error: 'Halköde kapalı.' }, { status: 503, headers });
  }

  let body: { bin?: string; amount?: number };
  try {
    body = (await req.json()) as { bin?: string; amount?: number };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers });
  }

  // Tam kart numarası gelirse bile YALNIZ ilk 6 hane kullanılır (loglanmaz).
  const bin = String(body.bin ?? '').replace(/\D/g, '').slice(0, 6);
  const amount = Number(body.amount ?? 0);
  if (bin.length < 6) {
    return NextResponse.json({ ok: false, error: 'bin_required' }, { status: 422, headers });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: 'amount_required' }, { status: 422, headers });
  }

  const t = await getToken();
  if (!t.ok) {
    return NextResponse.json({ ok: false, error: 'halkode_token_failed' }, { status: 502, headers });
  }

  const pos = await getPos(bin, amount, t.token);
  if (!pos.ok) {
    console.error('[halkode/installments] getpos başarısız', { bin, statusCode: pos.statusCode, error: pos.error });
    return NextResponse.json(
      { ok: false, error: 'halkode_getpos_failed', status_code: pos.statusCode },
      { status: 502, headers },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      installments: pos.installments.map((i) => ({
        installments_number: i.installments_number,
        amount_to_be_paid: i.amount_to_be_paid,
        payable_amount: i.payable_amount,
        card_type: i.card_type,
        card_program: i.card_program,
        card_scheme: i.card_scheme,
        pos_id: i.pos_id,
        title: i.title,
      })),
    },
    { status: 200, headers },
  );
}
