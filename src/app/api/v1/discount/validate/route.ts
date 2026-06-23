/**
 * POST /api/v1/discount/validate
 *
 * Storefront custom checkout → indirim kuponu doğrulama.
 * Shopify'daki gerçek discount code'u arar (REST lookup → price_rule) ve
 * tip (percentage | fixed_amount) + değerini döndürür. Frontend bu değerle
 * sepet üzerinden indirimi hesaplar; sipariş oluşturulurken tutar Shopify'a yazılır.
 *
 * Not: Sadece basit yüzde / sabit tutar kodlarını destekler (BXGY / free-shipping değil).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_ORIGIN = 'https://via-mood.myshopify.com';
const ALLOWED = [
  DEFAULT_ORIGIN,
  'https://d3z34m-iw.myshopify.com',
  'https://viamood.com',
  'https://www.viamood.com',
  'https://viamood.com.tr',
  'https://www.viamood.com.tr',
];

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED.includes(origin) ? origin : DEFAULT_ORIGIN;
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

interface PriceRule {
  id: number;
  value_type: 'percentage' | 'fixed_amount';
  value: string; // negatif, örn "-10.0"
  starts_at: string | null;
  ends_at: string | null;
  prerequisite_subtotal_range?: { greater_than_or_equal_to: string } | null;
  customer_selection?: string;
  status?: string;
}

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...cors(req.headers.get('origin')) };

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers });
  }

  const code = (body.code || '').trim();
  if (!code) return NextResponse.json({ ok: false, error: 'Kod boş.' }, { status: 422, headers });

  const token = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ ok: false, error: 'config' }, { status: 500, headers });

  const base = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}`;
  const h = { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' };

  try {
    // 1) Kodu ara → 303 ile discount_code'a yönlenir (price_rule_id içerir)
    const lookup = await fetch(`${base}/discount_codes/lookup.json?code=${encodeURIComponent(code)}`, {
      headers: h,
      redirect: 'follow',
    });
    if (lookup.status === 404) {
      return NextResponse.json({ ok: false, error: 'Bu indirim kodu geçersiz.' }, { status: 200, headers });
    }
    if (!lookup.ok) {
      return NextResponse.json({ ok: false, error: 'Kod doğrulanamadı.' }, { status: 200, headers });
    }
    const lj = (await lookup.json()) as { discount_code?: { price_rule_id: number; code: string } };
    const priceRuleId = lj.discount_code?.price_rule_id;
    if (!priceRuleId) {
      return NextResponse.json({ ok: false, error: 'Bu indirim kodu geçersiz.' }, { status: 200, headers });
    }

    // 2) Price rule → tip + değer + tarih + min. tutar
    const prResp = await fetch(`${base}/price_rules/${priceRuleId}.json`, { headers: h });
    if (!prResp.ok) {
      return NextResponse.json({ ok: false, error: 'Kod doğrulanamadı.' }, { status: 200, headers });
    }
    const pr = ((await prResp.json()) as { price_rule: PriceRule }).price_rule;

    // Sadece yüzde / sabit tutar
    if (pr.value_type !== 'percentage' && pr.value_type !== 'fixed_amount') {
      return NextResponse.json(
        { ok: false, error: 'Bu kupon bu sayfada uygulanamıyor.' },
        { status: 200, headers },
      );
    }

    // Tarih geçerliliği (server saatine göre kaba kontrol)
    const now = Date.now();
    if (pr.starts_at && new Date(pr.starts_at).getTime() > now) {
      return NextResponse.json({ ok: false, error: 'Bu kupon henüz başlamadı.' }, { status: 200, headers });
    }
    if (pr.ends_at && new Date(pr.ends_at).getTime() < now) {
      return NextResponse.json({ ok: false, error: 'Bu kuponun süresi dolmuş.' }, { status: 200, headers });
    }

    const value = Math.abs(parseFloat(pr.value)); // pozitif
    const minSubtotal = pr.prerequisite_subtotal_range?.greater_than_or_equal_to
      ? parseFloat(pr.prerequisite_subtotal_range.greater_than_or_equal_to)
      : 0;

    return NextResponse.json(
      {
        ok: true,
        code: lj.discount_code?.code || code,
        type: pr.value_type, // 'percentage' | 'fixed_amount'
        value, // yüzde (örn 10) veya sabit TL (örn 50)
        min_subtotal: minSubtotal, // TL — sepet ara toplamı bunun altındaysa uygulanmaz
      },
      { status: 200, headers },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : 'hata' },
      { status: 200, headers },
    );
  }
}
