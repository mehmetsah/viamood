/**
 * POST /api/v1/discount/validate  { code, line_items? }
 *
 * Storefront custom checkout → indirim kuponu doğrulama.
 * İndirim tutarı artık SUNUCUDA hesaplanır (lib/shopify/discount-resolve):
 * kupon ürün-bazlıysa (entitled) sadece HAK EDEN satırlara, o satırların
 * tutarıyla SINIRLI uygulanır. Frontend dönen `amount`ı olduğu gibi gösterir.
 *
 * Geçmiş: tutarı frontend hesaplıyordu ve kapsam hiç okunmuyordu → tek ürüne
 * tanımlı 200 TL'lik kupon ucuz ürünlere uygulanıp toplamı 0 TL yapıyordu.
 * Sonraki düzeltme kapsamlı kuponları topyekûn reddetti → mobilde (ürün detayında
 * kod alanı yok) meşru kampanya kullanılamaz oldu. Bu sürüm ikisini de çözer.
 *
 * Not: Sadece basit yüzde / sabit tutar kodlarını destekler (BXGY / free-shipping değil).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { resolveDiscount, type DiscountLineInput } from '@/lib/shopify/discount-resolve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_ORIGIN = env.STOREFRONT_URL;
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

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...cors(req.headers.get('origin')) };

  let body: { code?: string; line_items?: DiscountLineInput[]; email?: string; phone?: string; customer_id?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers });
  }

  const code = (body.code || '').trim();
  if (!code) return NextResponse.json({ ok: false, error: 'Kod bo\u015f.' }, { status: 422, headers });

  try {
    const r = await resolveDiscount(code, body.line_items ?? [], {
      email: body.email,
      phone: body.phone,
      customerId: body.customer_id,
    });
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: r.error }, { status: 200, headers });
    }
    return NextResponse.json(
      {
        ok: true,
        code: r.code,
        type: r.type,
        value: r.value,
        min_subtotal: r.minSubtotal,
        scoped: r.scoped,
        // Tema BUNU kullanır — kendi hesabını yapmaz (kapsam sunucuda uygulandı)
        amount: +(r.amountKurus / 100).toFixed(2),
        eligible_subtotal: +(r.eligibleSubtotalKurus / 100).toFixed(2),
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
