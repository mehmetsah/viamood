/**
 * POST /api/v1/payment/iyzico/initialize
 *
 * Storefront → sepet adresi + line items gönderir.
 * Biz İyzico CheckoutForm token + iframe HTML döneriz.
 * Müşteri İyzico iframe'inde kart girer (PCI yükü İyzico'da).
 *
 * Ödeme sonrası İyzico → /api/v1/payment/iyzico/callback POST'lar.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { initializeCheckoutForm } from '@/lib/iyzico/client';
import { provinceCode } from '@/lib/shopify/tr-provinces';
import { env } from '@/lib/env';

interface DraftOrderResp {
  draft_order?: { id: number; invoice_url?: string };
}

/**
 * İyzico ödemesi öncesi Shopify'da "open" draft order yaratır.
 * Ödeme başarılı olunca callback bu draft'ı complete eder (sipariş = ödendi).
 * Hata olursa null döner — ödeme yine de devam eder (draft sonradan manuel açılabilir).
 */
let _lastDraftError = '';
async function createDraftOrder(body: InitBody): Promise<number | null> {
  try {
    const phone = body.phone.replace(/\s/g, '');
    const pcode = provinceCode(body.province); // İl adı → TR-XX kodu
    const addr: Record<string, unknown> = {
      first_name: body.first_name,
      last_name: body.last_name,
      phone,
      address1: body.address1,
      address2: body.address2 || '',
      city: body.city, // İlçe
      province: body.province, // İl (ad)
      zip: body.zip || '',
      country: 'Turkey',
      country_code: 'TR',
    };
    if (pcode) addr.province_code = pcode; // Shopify il alanına oturması için

    // Kargo ücretini ayrı line item olarak ekle (sipariş toplamına dahil)
    const shippingTl = body.shipping_cost || 0;

    const payload: Record<string, unknown> = {
      draft_order: {
        line_items: body.line_items.map((li) => ({ variant_id: li.variant_id, quantity: li.quantity })),
        shipping_address: addr,
        billing_address: addr,
        email: body.email,
        tags: 'via-mood-storefront,iyzico-pending',
        note: `📍 ${body.first_name} ${body.last_name} · ${body.province}/${body.city}\n${buildInvoiceNote(body)}`,
        use_customer_default_address: false,
        // Kargo — Shopify draft order shipping_line
        ...(shippingTl > 0
          ? {
              shipping_line: {
                title: 'Standart Kargo (KargoLab)',
                price: shippingTl.toFixed(2),
              },
            }
          : {}),
      },
    };
    // Direct fetch + env token (shopifyRest retry body-reuse bug'ını bypass eder)
    const token = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    if (!token) {
      _lastDraftError = 'SHOPIFY_ADMIN_ACCESS_TOKEN yok';
      return null;
    }
    const resp = await fetch(
      `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/draft_orders.json`,
      {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (!resp.ok) {
      _lastDraftError = `HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`;
      return null;
    }
    const res = (await resp.json()) as DraftOrderResp;
    return res.draft_order?.id ?? null;
  } catch (e) {
    _lastDraftError = e instanceof Error ? e.message : String(e);
    return null;
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_ORIGIN = 'https://via-mood.myshopify.com';
const ALLOWED_ORIGINS = [
  DEFAULT_ORIGIN,
  'https://d3z34m-iw.myshopify.com',
  'https://viamood.com',
  'https://www.viamood.com',
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : DEFAULT_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

interface InitBody {
  line_items: Array<{ variant_id: number; quantity: number; title?: string; price?: number; product_type?: string }>;
  shipping_cost?: number; // kuruş veya TL? — TL kabul ediyoruz (number)
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address1: string;
  address2?: string;
  city: string; // İlçe
  province: string; // İl
  zip?: string;
  identity_number?: string;
  draft_order_id?: number; // Shopify draft order id (callback'te complete için)
  // Fatura bilgileri
  invoice_type?: string; // bireysel | kurumsal
  tc_no?: string;
  firma_adi?: string;
  vergi_no?: string;
  vergi_dairesi?: string;
  billing_diff?: string; // '1' | '0'
  billing_address1?: string;
  billing_il?: string;
  billing_ilce?: string;
}

function buildInvoiceNote(b: InitBody): string {
  const lines: string[] = [];
  if (b.invoice_type === 'kurumsal') {
    lines.push('🏢 KURUMSAL FATURA');
    if (b.firma_adi) lines.push(`   Firma: ${b.firma_adi}`);
    if (b.vergi_no) lines.push(`   Vergi No: ${b.vergi_no} · Dairesi: ${b.vergi_dairesi || '-'}`);
  } else {
    lines.push('👤 BİREYSEL FATURA');
    if (b.tc_no) lines.push(`   TC: ${b.tc_no}`);
  }
  if (b.billing_diff === '1' && b.billing_address1) {
    lines.push('📋 FARKLI FATURA ADRESİ:');
    lines.push(`   ${b.billing_address1} · ${b.billing_il || ''}/${b.billing_ilce || ''}`);
  }
  return lines.join('\n');
}

function toMoney(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...corsHeaders(req.headers.get('origin')) };

  let body: InitBody;
  try {
    body = (await req.json()) as InitBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers });
  }

  const missing: string[] = [];
  if (!body.first_name?.trim()) missing.push('first_name');
  if (!body.last_name?.trim()) missing.push('last_name');
  if (!body.phone?.trim()) missing.push('phone');
  if (!body.email?.includes('@')) missing.push('email');
  if (!body.address1?.trim()) missing.push('address1');
  if (!body.city?.trim()) missing.push('city');
  if (!body.province?.trim()) missing.push('province');
  if (!body.line_items?.length) missing.push('line_items');
  if (missing.length) {
    return NextResponse.json({ ok: false, error: 'missing_fields', missing }, { status: 422, headers });
  }

  // Fiyat hesabı (TL)
  let itemsTotal = 0;
  const basketItems = body.line_items.map((li, i) => {
    const unit = (li.price ?? 0) / 100; // Shopify price kuruş cinsinden gelir
    const lineTotal = unit * li.quantity;
    itemsTotal += lineTotal;
    return {
      id: String(li.variant_id || `item-${i}`),
      name: (li.title || 'Ürün').slice(0, 200),
      category: li.product_type || 'Genel',
      price: toMoney(lineTotal),
    };
  });

  const shipping = body.shipping_cost ?? 0;
  const paidTotal = itemsTotal + shipping;

  // Kargo'yu basket'e ayrı item olarak ekle ki price === sum(basketItems)
  if (shipping > 0) {
    basketItems.push({
      id: 'shipping',
      name: 'Kargo',
      category: 'Kargo',
      price: toMoney(shipping),
    });
  }

  const phone = body.phone.replace(/\s/g, '');
  const gsm = phone.startsWith('+') ? phone : `+90${phone.replace(/^0/, '')}`;
  const fullAddr = `${body.address1}${body.address2 ? ', ' + body.address2 : ''}, ${body.city}/${body.province}`;
  const conversationId = `vm-${Date.now()}-${Math.floor(itemsTotal)}`;

  // Shopify draft order yarat (ödeme öncesi). Ödeme başarılı → callback complete eder → sipariş.
  // body.draft_order_id varsa onu kullan (idempotent), yoksa yeni yarat.
  const draftOrderId = body.draft_order_id ?? (await createDraftOrder(body));

  // Callback URL — draft_order_id'yi query'de taşı
  const callbackUrl =
    `${env.IYZICO_CALLBACK_BASE}/api/v1/payment/iyzico/callback` +
    (draftOrderId ? `?draft=${draftOrderId}` : '');

  const addr = {
    contactName: `${body.first_name} ${body.last_name}`,
    city: body.province,
    country: 'Türkiye',
    address: fullAddr,
    zipCode: body.zip || '34000',
  };

  try {
    const result = await initializeCheckoutForm({
      conversationId,
      price: toMoney(itemsTotal + shipping), // basket toplamı (kargo dahil item olarak eklendi)
      paidPrice: toMoney(paidTotal),
      callbackUrl,
      buyer: {
        id: body.email,
        name: body.first_name,
        surname: body.last_name,
        gsmNumber: gsm,
        email: body.email,
        identityNumber: body.identity_number || '11111111111',
        registrationAddress: fullAddr,
        city: body.province,
        country: 'Türkiye',
        zipCode: body.zip || '34000',
      },
      shippingAddress: addr,
      billingAddress: addr,
      basketItems,
    });

    return NextResponse.json(
      {
        ok: true,
        token: result.token,
        checkoutFormContent: result.checkoutFormContent,
        paymentPageUrl: result.paymentPageUrl,
        conversationId,
        draft_order_id: draftOrderId,
        draft_error: _lastDraftError || undefined,
      },
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: 'iyzico_init_error', detail: msg.slice(0, 500) },
      { status: 502, headers },
    );
  }
}
