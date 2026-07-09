import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  orderEvents,
  orderLineItems,
  orders,
  productVariants,
  vendors,
} from '@/db/schema';
import { upsertCustomerByEmail } from '@/lib/customers/service';

/**
 * Shopify webhook payload'ından gelen order'ı local DB'ye yansıt.
 * Idempotent: aynı shopify_order_id ile çağrı tekrarında yeni satır oluşturmaz.
 *
 * NOT: Bu adım sadece veriyi yazar. Routing engine ayrı bir adımda çalışır
 * (routeOrder) — race condition'a karşı transaction sonrası tetiklenir.
 */

export interface ShopifyOrderPayload {
  id: number | string;
  name: string;
  email?: string | null;
  phone?: string | null;
  currency?: string;
  subtotal_price?: string;
  total_shipping_price_set?: { shop_money?: { amount?: string } };
  total_tax?: string;
  total_discounts?: string;
  total_price?: string;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  created_at?: string;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  source_name?: string | null;
  note?: string | null;
  tags?: string;
  customer?: {
    id?: number | null;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  };
  shipping_address?: {
    name?: string | null;
    phone?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    province?: string | null;
    zip?: string | null;
    country?: string | null;
    country_code?: string | null;
  } | null;
  line_items: Array<{
    id: number | string;
    variant_id?: number | string | null;
    product_id?: number | string | null;
    sku?: string | null;
    title: string;
    variant_title?: string | null;
    quantity: number;
    price?: string;
    total_discount?: string;
  }>;
}

interface IngestOk {
  ok: true;
  orderId: string;
  isNew: boolean;
  matchedLineItems: number;
  unmatchedLineItems: number;
}
interface IngestErr {
  ok: false;
  error: string;
}
export type IngestResult = IngestOk | IngestErr;

function parseMoney(raw: string | undefined | null): bigint {
  if (!raw) return 0n;
  const num = parseFloat(String(raw).replace(',', '.'));
  if (Number.isNaN(num)) return 0n;
  return BigInt(Math.round(num * 100));
}

/** "gid://shopify/ProductVariant/123" | 123 | "123" → "123" — format-bağımsız eşleştirme anahtarı */
function numericId(id: number | string | null | undefined): string | null {
  if (id == null) return null;
  const s = String(id);
  const m = /(\d+)\s*$/.exec(s);
  return m?.[1] ?? s;
}

type VariantMatch = {
  variantId: string;
  productId: string;
  vendorId: string;
  shopifyVariantId: string;
};

/**
 * Payload satırlarındaki variant'ları local DB ile eşleştirir.
 * DB'de shopifyVariantId HEM gid HEM numerik formatta bulunabiliyor (webhook gid yazar,
 * backfill/reconcile numerik yazdı — #1015 satırsız kaldı) → İKİ formatla ara,
 * map anahtarı her zaman numerik kısım.
 */
async function buildVariantMatches(
  lineItems: Array<{ variant_id?: number | string | null }>,
): Promise<Map<string, VariantMatch>> {
  const matches = new Map<string, VariantMatch>();
  const nums = lineItems
    .map((li) => numericId(li.variant_id))
    .filter((v): v is string => v !== null);
  if (nums.length === 0) return matches;

  const bothFormats = [...nums, ...nums.map((n) => `gid://shopify/ProductVariant/${n}`)];
  const rows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      vendorId: productVariants.vendorId,
      shopifyVariantId: productVariants.shopifyVariantId,
    })
    .from(productVariants)
    .where(inArray(productVariants.shopifyVariantId, bothFormats));
  for (const r of rows) {
    const key = numericId(r.shopifyVariantId);
    if (!key) continue;
    matches.set(key, {
      variantId: r.id,
      productId: r.productId,
      vendorId: r.vendorId,
      shopifyVariantId: r.shopifyVariantId,
    });
  }
  return matches;
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

const FINANCIAL_STATUS_MAP: Record<string, 'pending' | 'authorized' | 'paid' | 'partially_paid' | 'refunded' | 'partially_refunded' | 'voided'> = {
  pending: 'pending',
  authorized: 'authorized',
  paid: 'paid',
  partially_paid: 'partially_paid',
  refunded: 'refunded',
  partially_refunded: 'partially_refunded',
  voided: 'voided',
};

const FULFILLMENT_STATUS_MAP: Record<string, 'unfulfilled' | 'partial' | 'fulfilled' | 'restocked'> = {
  fulfilled: 'fulfilled',
  partial: 'partial',
  restocked: 'restocked',
};

export async function ingestShopifyOrder(payload: ShopifyOrderPayload): Promise<IngestResult> {
  if (!payload.id || !payload.line_items || payload.line_items.length === 0) {
    return { ok: false, error: 'Geçersiz Shopify payload (id veya line_items eksik)' };
  }

  const shopifyOrderId = String(payload.id);

  // Idempotent: aynı order daha önce eklendiyse hemen dön
  const [existing] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.shopifyOrderId, shopifyOrderId))
    .limit(1);
  if (existing) {
    return {
      ok: true,
      orderId: existing.id,
      isNew: false,
      matchedLineItems: payload.line_items.length,
      unmatchedLineItems: 0,
    };
  }

  // Variant ID'leri topla, local DB'de eşleşeni bul (gid + numerik format toleranslı)
  const variantMatches = await buildVariantMatches(payload.line_items);

  const customerName = [payload.customer?.first_name, payload.customer?.last_name]
    .filter(Boolean)
    .join(' ') || null;

  const subtotalCents = parseMoney(payload.subtotal_price);
  const shippingCents = parseMoney(payload.total_shipping_price_set?.shop_money?.amount);
  const taxCents = parseMoney(payload.total_tax);
  const discountCents = parseMoney(payload.total_discounts);
  const totalCents = parseMoney(payload.total_price);

  const shippingAddr = payload.shipping_address
    ? {
        name: payload.shipping_address.name ?? undefined,
        phone: payload.shipping_address.phone ?? undefined,
        address1: payload.shipping_address.address1 ?? undefined,
        address2: payload.shipping_address.address2 ?? undefined,
        city: payload.shipping_address.city ?? undefined,
        district: payload.shipping_address.province ?? undefined,
        postalCode: payload.shipping_address.zip ?? undefined,
        country: payload.shipping_address.country ?? undefined,
        countryCode: payload.shipping_address.country_code ?? undefined,
      }
    : null;

  const placedAt = payload.created_at ? new Date(payload.created_at) : new Date();

  const fin: 'pending' | 'authorized' | 'paid' | 'partially_paid' | 'refunded' | 'partially_refunded' | 'voided' =
    (payload.financial_status && FINANCIAL_STATUS_MAP[payload.financial_status]) || 'pending';
  const ful: 'unfulfilled' | 'partial' | 'fulfilled' | 'restocked' =
    (payload.fulfillment_status && FULFILLMENT_STATUS_MAP[payload.fulfillment_status]) || 'unfulfilled';

  let matched = 0;
  let unmatched = 0;
  let orderId = '';

  await db.transaction(async (tx) => {
    const insertValues: typeof orders.$inferInsert = {
      shopifyOrderId,
      shopifyOrderName: payload.name ?? `#${shopifyOrderId}`,
      customerId: payload.customer?.id ? String(payload.customer.id) : null,
      customerEmail: payload.customer?.email ?? payload.email ?? null,
      customerName,
      customerPhone: payload.customer?.phone ?? payload.phone ?? null,
      shippingAddress: shippingAddr,
      subtotalCents,
      shippingCents,
      taxCents,
      discountCents,
      totalCents,
      currency: payload.currency ?? 'TRY',
      financialStatus: fin,
      fulfillmentStatus: ful,
      cancelledAt: payload.cancelled_at ? new Date(payload.cancelled_at) : null,
      cancelReason: payload.cancel_reason ?? null,
      sourceName: payload.source_name ?? null,
      note: payload.note ?? null,
      tags: parseTags(payload.tags),
      placedAt,
      rawShopifyPayload: payload as unknown as Record<string, unknown>,
    };
    const [created] = await tx
      .insert(orders)
      .values(insertValues)
      .returning({ id: orders.id });

    if (!created) throw new Error('Order insert başarısız');
    orderId = created.id;

    const vendorIdSet = new Set<string>();

    for (const li of payload.line_items) {
      const variantKey = numericId(li.variant_id);
      const match = variantKey ? variantMatches.get(variantKey) : undefined;

      if (!match) {
        unmatched += 1;
        // Eşleşmeyen line_item — Via Mood'un kendi (non-vendor) ürünleri olabilir.
        // Bu durumda routing dışı bir line_item — şimdilik yazmıyoruz, audit için raw payload'da kalır.
        continue;
      }
      matched += 1;
      vendorIdSet.add(match.vendorId);

      await tx.insert(orderLineItems).values({
        orderId: created.id,
        vendorId: match.vendorId,
        productId: match.productId,
        variantId: match.variantId,
        shopifyLineItemId: String(li.id),
        title: li.title,
        variantTitle: li.variant_title ?? null,
        sku: li.sku ?? null,
        quantity: li.quantity,
        unitPriceCents: parseMoney(li.price),
        totalPriceCents: parseMoney(li.price) * BigInt(li.quantity),
        discountCents: parseMoney(li.total_discount),
        status: 'pending',
      });
    }

    // Vendor distribution snapshot
    const vendorIds = [...vendorIdSet];
    await tx
      .update(orders)
      .set({
        vendorCount: vendorIds.length,
        vendorIds,
      })
      .where(eq(orders.id, created.id));

    // Active order count'u her vendor için artır
    if (vendorIds.length > 0) {
      await tx
        .update(vendors)
        .set({ activeOrderCount: sql`${vendors.activeOrderCount} + 1` })
        .where(inArray(vendors.id, vendorIds));
    }

    // Order event
    await tx.insert(orderEvents).values({
      orderId: created.id,
      eventType: 'order.received',
      actorType: 'system',
      payload: {
        shopifyOrderId,
        matchedLineItems: matched,
        unmatchedLineItems: unmatched,
      },
    });
  });

  // FAZ 1 dual-write: müşteriyi RDS customers'a yansıt (email köprüsü).
  // Transaction DIŞINDA + best-effort (upsertCustomerByEmail kendi içinde try/catch) →
  // bir hata webhook/order yazımını ASLA bozmaz.
  const custEmail = payload.customer?.email ?? payload.email ?? null;
  if (custEmail) {
    await upsertCustomerByEmail({
      email: custEmail,
      shopifyCustomerId: payload.customer?.id ? String(payload.customer.id) : null,
      name: customerName,
      phone: payload.customer?.phone ?? payload.phone ?? null,
    });
  }

  return { ok: true, orderId, isNew: true, matchedLineItems: matched, unmatchedLineItems: unmatched };
}

/**
 * Satırsız kalmış siparişi onarır: raw Shopify payload'ındaki line_items'ı
 * (gid+numerik toleranslı eşleştirmeyle) orderLineItems'a yazar.
 * Eski format-uyuşmazlığı mağdurları için (örn. #1015) — satırı OLAN siparişe dokunmaz.
 */
export async function repairOrderLines(
  orderId: string,
): Promise<{ ok: boolean; added: number; unmatched: number; error?: string }> {
  const [ord] = await db
    .select({ id: orders.id, raw: orders.rawShopifyPayload })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!ord) return { ok: false, added: 0, unmatched: 0, error: 'order bulunamadı' };

  const [hasLine] = await db
    .select({ id: orderLineItems.id })
    .from(orderLineItems)
    .where(eq(orderLineItems.orderId, orderId))
    .limit(1);
  if (hasLine) return { ok: true, added: 0, unmatched: 0, error: 'zaten satırlı — dokunulmadı' };

  const payload = ord.raw as ShopifyOrderPayload | null;
  if (!payload?.line_items?.length) {
    return { ok: false, added: 0, unmatched: 0, error: 'raw payload satırı yok' };
  }

  const matches = await buildVariantMatches(payload.line_items);
  let added = 0;
  let unmatched = 0;
  for (const li of payload.line_items) {
    const key = numericId(li.variant_id);
    const match = key ? matches.get(key) : undefined;
    if (!match) {
      unmatched += 1;
      continue;
    }
    await db.insert(orderLineItems).values({
      orderId,
      vendorId: match.vendorId,
      productId: match.productId,
      variantId: match.variantId,
      shopifyLineItemId: String(li.id),
      title: li.title,
      variantTitle: li.variant_title ?? null,
      sku: li.sku ?? null,
      quantity: li.quantity,
      unitPriceCents: parseMoney(li.price),
      totalPriceCents: parseMoney(li.price) * BigInt(li.quantity),
      discountCents: parseMoney(li.total_discount),
      status: 'pending',
    });
    added += 1;
  }
  return { ok: true, added, unmatched };
}
