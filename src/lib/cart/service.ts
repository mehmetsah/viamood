/**
 * Native sepet servisi (FAZ 2 Dilim 4 backend).
 *
 * Token bazlı RDS sepet — Shopify cart session'ın karşılığı. Fiyat/başlık/vendor READ'de
 * `product_variants`'tan türetilir (otoriter kaynak). Tema henüz bunu KULLANMIYOR; katman
 * hazır dururken sonra `/cart.js` yerine bağlanacak. `cartToStorefrontBody` ile native sipariş
 * oluşturmaya devredilebilir (havale/COD/kart akışları).
 */
import { randomUUID } from 'node:crypto';
import { getAllowedOrigins } from '@/lib/cors';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { carts, productVariants, vendors, type CartItem } from '@/db/schema';
import { env } from '@/lib/env';
import { getStore } from '@/lib/store';
import type {
  StorefrontOrderBody,
  StorefrontPaymentMethod,
} from '@/lib/shopify/create-storefront-order';

type CartRow = typeof carts.$inferSelect;

export interface CartLineView {
  variant_id: string;
  quantity: number;
  title: string;
  vendor: string | null;
  unit_price_cents: number;
  line_price_cents: number;
  matched: boolean; // RDS'te variant bulundu mu
}
export interface CartView {
  token: string;
  item_count: number;
  items: CartLineView[];
  items_subtotal_cents: number;
  attributes: Record<string, string>;
  note: string | null;
}

const ALLOWED_ORIGINS = getAllowedOrigins();
export function cartCors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : env.STOREFRONT_URL;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function normalizeQty(q: unknown): number {
  const n = Math.floor(Number(q));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function loadByToken(token: string): Promise<CartRow | null> {
  const [c] = await db.select().from(carts).where(eq(carts.token, token)).limit(1);
  return c ?? null;
}

export async function getOrCreateCart(token?: string | null, customerId?: string | null): Promise<CartRow> {
  if (token) {
    const existing = await loadByToken(token);
    if (existing) return existing;
  }
  const [created] = await db
    .insert(carts)
    .values({ token: token || randomUUID(), customerId: customerId ?? null, items: [], attributes: {} })
    .returning();
  if (!created) throw new Error('cart oluşturulamadı');
  return created;
}

async function persistItems(id: string, items: CartItem[]): Promise<CartRow> {
  const [updated] = await db.update(carts).set({ items, updatedAt: new Date() }).where(eq(carts.id, id)).returning();
  if (!updated) throw new Error('cart güncellenemedi');
  return updated;
}

export async function addItem(
  token: string | null | undefined,
  variantId: string,
  quantity: number,
  customerId?: string | null,
): Promise<CartRow> {
  const cart = await getOrCreateCart(token, customerId);
  const qty = normalizeQty(quantity) || 1;
  const items = [...(cart.items ?? [])];
  const idx = items.findIndex((i) => i.variant_id === variantId);
  if (idx >= 0) items[idx] = { ...items[idx]!, quantity: items[idx]!.quantity + qty };
  else items.push({ variant_id: variantId, quantity: qty });
  return persistItems(cart.id, items);
}

export async function changeItem(token: string, variantId: string, quantity: number): Promise<CartRow> {
  const cart = await getOrCreateCart(token);
  const qty = normalizeQty(quantity);
  let items = [...(cart.items ?? [])];
  if (qty === 0) {
    items = items.filter((i) => i.variant_id !== variantId);
  } else {
    const idx = items.findIndex((i) => i.variant_id === variantId);
    if (idx >= 0) items[idx] = { ...items[idx]!, quantity: qty };
    else items.push({ variant_id: variantId, quantity: qty });
  }
  return persistItems(cart.id, items);
}

export async function updateCart(
  token: string,
  patch: { attributes?: Record<string, string>; note?: string | null },
): Promise<CartRow> {
  const cart = await getOrCreateCart(token);
  const attributes = patch.attributes ? { ...(cart.attributes ?? {}), ...patch.attributes } : cart.attributes;
  const [updated] = await db
    .update(carts)
    .set({ attributes, note: patch.note !== undefined ? patch.note : cart.note, updatedAt: new Date() })
    .where(eq(carts.id, cart.id))
    .returning();
  if (!updated) throw new Error('cart güncellenemedi');
  return updated;
}

/** Sepeti fiyat/başlık/vendor ile zenginleştirilmiş görünüme çevirir (RDS otoriter). */
export async function cartView(cart: CartRow): Promise<CartView> {
  const items = cart.items ?? [];
  const variantIds = items.map((i) => i.variant_id).filter(Boolean);
  const rows = variantIds.length
    ? await db
        .select({
          sv: productVariants.shopifyVariantId,
          price: productVariants.priceCents,
          title: productVariants.title,
          vendorName: vendors.name,
        })
        .from(productVariants)
        .leftJoin(vendors, eq(vendors.id, productVariants.vendorId))
        .where(inArray(productVariants.shopifyVariantId, variantIds))
    : [];
  const byVariant = new Map(rows.map((r) => [r.sv, r]));
  let subtotal = 0;
  const lines: CartLineView[] = items.map((i) => {
    const r = byVariant.get(i.variant_id);
    const unit = r?.price != null ? Number(r.price) : 0;
    const line = unit * i.quantity;
    subtotal += line;
    return {
      variant_id: i.variant_id,
      quantity: i.quantity,
      title: r?.title ?? 'Ürün',
      vendor: r?.vendorName ?? null,
      unit_price_cents: unit,
      line_price_cents: line,
      matched: !!r,
    };
  });
  return {
    token: cart.token,
    item_count: items.reduce((s, i) => s + i.quantity, 0),
    items: lines,
    items_subtotal_cents: subtotal,
    attributes: cart.attributes ?? {},
    note: cart.note,
  };
}

/**
 * Sepeti native sipariş gövdesine (StorefrontOrderBody) çevirir — checkout devir noktası.
 * attributes anahtarları: first_name,last_name,phone,email,address1,mahalle,il,ilce,postal_code,
 * invoice_type,tc_no,firma_adi,vergi_no,vergi_dairesi,shipping_cost,shipping_courier,
 * discount_code,discount_amount,cod_method,cod_surcharge.
 */
export function cartToStorefrontBody(cart: CartRow): StorefrontOrderBody {
  const a = cart.attributes ?? {};
  const num = (v?: string) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
  return {
    line_items: (cart.items ?? []).map((i) => ({
      variant_id: i.variant_id as unknown as number, // native create String() ile tolere eder (gid/numerik)
      quantity: i.quantity,
    })),
    first_name: a.first_name ?? '',
    last_name: a.last_name ?? '',
    phone: a.phone ?? '',
    email: a.email ?? '',
    address1: a.address1 ?? '',
    address2: a.mahalle ?? a.address2,
    city: a.ilce ?? '', // ilçe
    province: a.il ?? '', // il
    zip: a.postal_code,
    customer_id: cart.customerId ? num(cart.customerId) : undefined,
    customer_email: a.email,
    invoice_type: a.invoice_type,
    tc_no: a.tc_no,
    firma_adi: a.firma_adi,
    vergi_no: a.vergi_no,
    vergi_dairesi: a.vergi_dairesi,
    shipping_cost: num(a.shipping_cost),
    shipping_courier: a.shipping_courier,
    discount_code: a.discount_code,
    discount_amount: num(a.discount_amount),
    cod_method: (a.cod_method as 'nakit' | 'kart' | '') || undefined,
    cod_surcharge: num(a.cod_surcharge),
  };
}

export type CheckoutResult =
  | { ok: true; order_code: string; order_id: string | number; total: number }
  | { ok: false; error: string };

/**
 * Sepeti native siparişe dönüştürür (havale / COD — anında oluşan siparişler).
 * Kart için bu KULLANILMAZ: kart önce ödeme init (iyzico/paytr) → callback'te pending→paid
 * akışını izler; orada native pending order zaten `createNativeCardPendingOrder` ile açılır.
 * STORE_BACKEND flag'i `getStore()` üzerinden belirler (native ya da Shopify).
 */
export async function checkoutCart(
  token: string,
  paymentMethod: StorefrontPaymentMethod,
): Promise<CheckoutResult> {
  const cart = await getOrCreateCart(token);
  if (!(cart.items ?? []).length) return { ok: false, error: 'sepet boş' };
  if (cart.status === 'converted') return { ok: false, error: 'sepet zaten siparişe dönüştürüldü' };

  const body = cartToStorefrontBody(cart);
  const created = await (await getStore()).createStorefrontOrder(body, paymentMethod);
  if (!created.ok) return { ok: false, error: created.error };

  await db
    .update(carts)
    .set({
      status: 'converted',
      convertedOrderId: typeof created.orderId === 'string' ? created.orderId : null,
      updatedAt: new Date(),
    })
    .where(eq(carts.id, cart.id));

  return { ok: true, order_code: created.orderName, order_id: created.orderId, total: created.total };
}
