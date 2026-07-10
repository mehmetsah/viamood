/**
 * POST /api/v1/payment/paytr/initialize
 *
 * Storefront → sepet + adres gönderir. Biz:
 *   1) Shopify'da "open" draft order yaratırız (ödeme öncesi; callback complete eder).
 *   2) PayTR get-token ile iframe token alırız.
 *   3) { ok, token, iframe_url } döneriz → frontend iframe'i gömer.
 *
 * Ödeme sonucu PayTR'ın BİLDİRİM URL'ine (panelde sabit: .../paytr/callback) server-to-server POST'lanır.
 * merchant_oid'e draft order id gömülür ki callback doğru draft'ı complete etsin.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { provinceCode } from '@/lib/shopify/tr-provinces';
import { upsertCustomerAddress } from '@/lib/shopify/customer-address';
import { ensureTrCustomer } from '@/lib/shopify/customer-locale';
import { getPaytrToken, buildMerchantOid, paytrConfigured, type PaytrBasketItem } from '@/lib/paytr/client';
import { getStore, type StorefrontOrderBody } from '@/lib/store';
import { createNativeCardPendingOrder } from '@/lib/store/native-create-order';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STOREFRONT = env.STOREFRONT_URL;

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

interface PaytrInitBody {
  line_items: Array<{ variant_id: number; quantity: number; title?: string; price?: number }>;
  shipping_cost?: number; // TL
  shipping_courier?: string; // müşterinin checkout'ta seçtiği kurye (otomatik etiket bunu kullanır)
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address1: string;
  address2?: string;
  city: string; // ilçe
  province: string; // il
  zip?: string;
  customer_id?: number;
  customer_email?: string;
  discount_code?: string;
  discount_amount?: number; // TL
  invoice_type?: string;
  tc_no?: string;
  firma_adi?: string;
  vergi_no?: string;
  vergi_dairesi?: string;
}

function invoiceNote(b: PaytrInitBody): string {
  const lines: string[] = [];
  if (b.invoice_type === 'kurumsal') {
    lines.push('🏢 KURUMSAL FATURA');
    if (b.firma_adi) lines.push(`   Firma: ${b.firma_adi}`);
    if (b.vergi_no) lines.push(`   Vergi No: ${b.vergi_no} · Dairesi: ${b.vergi_dairesi || '-'}`);
  } else {
    lines.push('👤 BİREYSEL FATURA');
    if (b.tc_no) lines.push(`   TC: ${b.tc_no}`);
  }
  return lines.join('\n');
}

/** Shopify "open" draft order (PayTR ödemesi öncesi). Hata → null (ödeme yine devam, manuel açılabilir). */
async function createDraftOrder(b: PaytrInitBody): Promise<number | null> {
  const token = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token) return null;
  const phone = b.phone.replace(/\s/g, '');
  const pcode = provinceCode(b.province);
  const addr: Record<string, unknown> = {
    first_name: b.first_name,
    last_name: b.last_name,
    phone,
    address1: b.address1,
    address2: b.address2 || '',
    city: b.city,
    province: b.province,
    zip: b.zip || '',
    country: 'Turkey',
    country_code: 'TR',
  };
  if (pcode) addr.province_code = pcode;
  const shippingTl = b.shipping_cost || 0;
  const payload = {
    draft_order: {
      line_items: b.line_items.map((li) => ({ variant_id: li.variant_id, quantity: li.quantity })),
      shipping_address: addr,
      billing_address: addr,
      ...(b.customer_id ? { customer: { id: b.customer_id } } : { email: b.email }),
      email: b.customer_email || b.email,
      tags: 'via-mood-storefront,paytr-pending',
      note: `📍 ${b.first_name} ${b.last_name} · ${b.province}/${b.city}\n💳 PayTR\n${invoiceNote(b)}`,
      use_customer_default_address: false,
      ...(shippingTl > 0
        ? { shipping_line: { title: b.shipping_courier || 'Standart Kargo (KargoLab)', price: shippingTl.toFixed(2) } }
        : {}),
      ...((b.discount_amount ?? 0) > 0
        ? {
            applied_discount: {
              description: b.discount_code || 'İndirim',
              value_type: 'fixed_amount',
              value: (b.discount_amount as number).toFixed(2),
              amount: (b.discount_amount as number).toFixed(2),
            },
          }
        : {}),
    },
  };
  try {
    const resp = await fetch(
      `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/draft_orders.json`,
      {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (!resp.ok) return null;
    const j = (await resp.json()) as { draft_order?: { id: number } };
    const _did = j.draft_order?.id ?? null;
    if (_did && b.customer_id) {
      await upsertCustomerAddress({
        customerId: b.customer_id,
        first_name: b.first_name,
        last_name: b.last_name,
        phone: b.phone,
        address1: b.address1,
        address2: b.address2,
        city: b.city,
        province: b.province,
        zip: b.zip,
      });
    }
    return _did;
  } catch {
    return null;
  }
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  const ip = (xff.split(',')[0] || '').trim() || req.headers.get('x-real-ip') || '85.34.78.112';
  return ip.slice(0, 39);
}

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...cors(req.headers.get('origin')) };

  if (!(await paytrConfigured())) {
    return NextResponse.json({ ok: false, error: 'PayTR henüz yapılandırılmadı (env eksik).' }, { status: 503, headers });
  }

  let body: PaytrInitBody;
  try {
    body = (await req.json()) as PaytrInitBody;
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

  // Tutar (kuruş): ürünler + kargo − indirim
  const itemsKurus = body.line_items.reduce((s, li) => s + Math.round(li.price ?? 0) * li.quantity, 0);
  const shipKurus = Math.round((body.shipping_cost || 0) * 100);
  const discKurus = Math.round((body.discount_amount || 0) * 100);
  const paymentAmountKurus = Math.max(1, itemsKurus + shipKurus - discKurus);

  const basket: PaytrBasketItem[] = body.line_items.map((li) => ({
    name: li.title || `Ürün ${li.variant_id}`,
    priceTl: (li.price ?? 0) / 100,
    quantity: li.quantity,
  }));
  if (shipKurus > 0) basket.push({ name: 'Kargo', priceTl: shipKurus / 100, quantity: 1 });
  if (discKurus > 0) basket.push({ name: 'İndirim', priceTl: -discKurus / 100, quantity: 1 });

  // Onay maili Türkçe gitsin: müşteri siparişten ÖNCE tr locale'iyle var edilir
  await ensureTrCustomer(body.customer_email || body.email);

  // STORE_BACKEND='native' → RDS pending native order (numerik ref); aksi → Shopify draft (değişmez)
  const draftId =
    (await getStore()).backend === 'native'
      ? await createNativeCardPendingOrder(body as unknown as StorefrontOrderBody)
      : await createDraftOrder(body);
  const merchantOid = buildMerchantOid(draftId, Date.now().toString(36));

  const result = await getPaytrToken({
    merchantOid,
    email: body.email.trim(),
    paymentAmountKurus,
    basket,
    userIp: clientIp(req),
    userName: `${body.first_name} ${body.last_name}`.trim(),
    userAddress: `${body.address1}${body.address2 ? ', ' + body.address2 : ''}, ${body.city}/${body.province}`,
    userPhone: body.phone.replace(/\s/g, ''),
    // ref = merchant_oid → başarı sayfasında "Ödeme Referansı" olarak gösterilir (PayTR panelinde aranabilir)
    okUrl: `${STOREFRONT}/pages/siparis-alindi?ref=${merchantOid}${draftId ? '&order=' + draftId : ''}`,
    failUrl: `${STOREFRONT}/pages/odeme-hata?reason=paytr`,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: 'paytr_token_failed', detail: result.error }, { status: 502, headers });
  }

  return NextResponse.json(
    { ok: true, token: result.token, iframe_url: `https://www.paytr.com/odeme/guvenli/${result.token}` },
    { status: 200, headers },
  );
}
