/**
 * Storefront custom checkout → Shopify "pending" (ödenmemiş) gerçek sipariş oluşturur.
 *
 * Havale ve Kapıda Ödeme için ortak. İyzico'dan farkı: peşin ödeme yok, sipariş
 * `financial_status: pending` olarak açılır ve:
 *   - Müşterinin hesabında hemen görünür
 *   - orders/create webhook'u ile AWS vendor paneline düşer (per-vendor onay akışı)
 *   - Havale onaylanınca / kapıda tahsil edilince admin/tedarikçi "paid" işaretler
 *
 * Gerçek sipariş = Orders API (draft değil) ki webhook + müşteri hesabı + routing çalışsın.
 */
import { provinceCode } from './tr-provinces';
import { env } from '../env';

export type StorefrontPaymentMethod = 'havale' | 'cod';

export interface StorefrontOrderBody {
  line_items: Array<{ variant_id: number; quantity: number; sku?: string; price?: number; title?: string; product_type?: string }>;
  shipping_cost?: number; // TL
  shipping_courier?: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address1: string;
  address2?: string; // mahalle
  city: string; // ilçe
  province: string; // il
  zip?: string;
  customer_id?: number;
  customer_email?: string;
  invoice_type?: string; // bireysel | kurumsal
  tc_no?: string;
  firma_adi?: string;
  vergi_no?: string;
  vergi_dairesi?: string;
  billing_diff?: string; // '1' | '0'
  billing_address1?: string;
  billing_il?: string;
  billing_ilce?: string;
  cod_method?: 'nakit' | 'kart' | ''; // kapıda ödeme alt-tipi (kargo firmasına göre)
  cod_surcharge?: number; // TL — kapıda KART komisyonu (toplamın %4'ü)
}

export interface CreatedOrder {
  ok: true;
  orderId: number;
  orderName: string; // #1006
  total: number; // TL
}
export interface OrderErr {
  ok: false;
  error: string;
}

const TAGS: Record<StorefrontPaymentMethod, string> = {
  havale: 'via-mood-storefront,havale-pending,odeme-bekliyor',
  cod: 'via-mood-storefront,kapida-odeme,tahsilatli-kargo',
};
const GATEWAY: Record<StorefrontPaymentMethod, string> = {
  havale: 'Havale / EFT',
  cod: 'Kapıda Ödeme',
};

function invoiceNote(b: StorefrontOrderBody): string {
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
    const loc = [b.billing_il, b.billing_ilce].filter(Boolean).join(' / ');
    lines.push(`   ${b.billing_address1}${loc ? ' — ' + loc : ''}`);
  }
  return lines.join('\n');
}

export async function createStorefrontOrder(
  b: StorefrontOrderBody,
  method: StorefrontPaymentMethod,
): Promise<CreatedOrder | OrderErr> {
  const token = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token) return { ok: false, error: 'SHOPIFY_ADMIN_ACCESS_TOKEN yok' };

  const phone = b.phone.replace(/\s/g, '');
  const pcode = provinceCode(b.province);
  const addr: Record<string, unknown> = {
    first_name: b.first_name,
    last_name: b.last_name,
    phone,
    address1: b.address1,
    address2: b.address2 || '',
    city: b.city, // ilçe
    province: b.province, // il
    zip: b.zip || '',
    country: 'Turkey',
    country_code: 'TR',
  };
  if (pcode) addr.province_code = pcode;

  const shippingTl = b.shipping_cost || 0;

  // Kapıda KART ödemesi → %4 komisyon ayrı özel satır olarak eklenir (Shopify toplam + KargoLab tahsilat tutarına yansır)
  const codCard = method === 'cod' && b.cod_method === 'kart' && (b.cod_surcharge || 0) > 0;
  const lineItems: Array<Record<string, unknown>> = b.line_items.map((li) => ({
    variant_id: li.variant_id,
    quantity: li.quantity,
  }));
  if (codCard) {
    lineItems.push({
      title: 'Kapıda Kart Komisyonu (%4)',
      price: (b.cod_surcharge as number).toFixed(2),
      quantity: 1,
      requires_shipping: false,
      taxable: false,
    });
  }
  const codTipi = method === 'cod' ? (b.cod_method === 'kart' ? 'Kart' : 'Nakit') : '';

  const order: Record<string, unknown> = {
    line_items: lineItems,
    email: b.customer_email || b.email,
    phone,
    shipping_address: addr,
    billing_address: addr,
    financial_status: 'pending', // ödenmemiş — havale onayı / kapıda tahsilat bekliyor
    gateway: GATEWAY[method],
    tags: TAGS[method] + (codCard ? ',kapida-kart' : ''),
    note: `📍 ${b.first_name} ${b.last_name} · ${b.province}/${b.city}\n💳 ${GATEWAY[method]}${codTipi ? ' (' + codTipi + ')' : ''}\n${invoiceNote(b)}`,
    note_attributes: [
      { name: '_odeme_yontemi', value: method },
      ...(method === 'cod'
        ? [
            { name: '_kapida_odeme', value: '1' },
            { name: '_kapida_odeme_tipi', value: b.cod_method || 'nakit' },
          ]
        : []),
    ],
    send_receipt: true,
    send_fulfillment_receipt: false,
    inventory_behaviour: 'decrement_obeying_policy',
    ...(b.customer_id ? { customer: { id: b.customer_id } } : {}),
    ...(shippingTl > 0
      ? { shipping_lines: [{ title: b.shipping_courier || 'Kargo (KargoLab)', price: shippingTl.toFixed(2), code: 'kargolab' }] }
      : {}),
  };

  try {
    const resp = await fetch(
      `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/orders.json`,
      {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      },
    );
    if (!resp.ok) {
      return { ok: false, error: `Shopify HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}` };
    }
    const j = (await resp.json()) as { order?: { id: number; name: string; total_price?: string } };
    if (!j.order?.id) return { ok: false, error: 'order response boş' };
    return {
      ok: true,
      orderId: j.order.id,
      orderName: j.order.name,
      total: parseFloat(j.order.total_price || '0'),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
