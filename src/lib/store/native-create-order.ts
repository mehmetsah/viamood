/**
 * FAZ 2 Dilim 1 — Native storefront sipariş oluşturma (havale + COD).
 *
 * Shopify yerine RDS'e yazar (STORE_BACKEND='native'). Mevcut downstream (routing/mikro)
 * webhook'la AYNI fonksiyonlarla tetiklenir. PCI etkisi YOK (havale=banka, COD=kurye).
 * `create-storefront-order.ts` (Shopify) tutar/COD mantığı + `order-ingest.ts` il/ilçe
 * konvansiyonu (shippingAddress.district=il, .city=ilçe) aynalanır.
 */
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { orderLineItems, orders, productVariants } from '@/db/schema';
import { env } from '@/lib/env';
import { decrementForOrder } from '@/lib/inventory/decrement';
import { markOrderPaid } from '@/lib/orders/lifecycle';
import { nextOrderNumber } from '@/lib/orders/sequence';
import { routeOrder } from '@/lib/routing/engine';
import { syncOrderToMikro } from '@/lib/server/mikro-sync';
import { autoFulfillOrder } from '@/lib/server/auto-fulfill';
import { orderConfirmationEmail } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/sender';
import { upsertCustomerAddress } from '@/lib/shopify/customer-address';
import { resolveVendorIbans } from '@/lib/shopify/vendor-ibans';
import type {
  CreatedOrder,
  OrderErr,
  StorefrontOrderBody,
  StorefrontPaymentMethod,
} from '@/lib/shopify/create-storefront-order';

const toCents = (tl: number): bigint => BigInt(Math.round((tl || 0) * 100));

export async function createNativeStorefrontOrder(
  b: StorefrontOrderBody,
  method: StorefrontPaymentMethod,
): Promise<CreatedOrder | OrderErr> {
  try {
    // 1) variant_id (Shopify) → RDS variant/product/vendor/price
    const variantIds = b.line_items.map((li) => String(li.variant_id)).filter(Boolean);
    const vRows = variantIds.length
      ? await db
          .select({
            shopifyVariantId: productVariants.shopifyVariantId,
            id: productVariants.id,
            productId: productVariants.productId,
            vendorId: productVariants.vendorId,
            priceCents: productVariants.priceCents,
            title: productVariants.title,
            sku: productVariants.sku,
          })
          .from(productVariants)
          .where(inArray(productVariants.shopifyVariantId, variantIds))
      : [];
    const byVariant = new Map(vRows.map((r) => [r.shopifyVariantId, r]));

    // 2) Tutarlar + line item insert'leri (sadece eşleşen/vendor'lu satırlar yazılır — order-ingest deseni)
    let subtotalCents = 0n;
    const matched: Array<{ vendorId: string; variantId: string; quantity: number }> = [];
    const vendorIdSet = new Set<string>();
    const liInserts: Array<typeof orderLineItems.$inferInsert> = [];

    b.line_items.forEach((li, i) => {
      const r = byVariant.get(String(li.variant_id));
      const unitCents = r?.priceCents != null ? BigInt(r.priceCents) : toCents(li.price ?? 0);
      const lineCents = unitCents * BigInt(li.quantity);
      subtotalCents += lineCents;
      if (r?.vendorId) {
        vendorIdSet.add(r.vendorId);
        matched.push({ vendorId: r.vendorId, variantId: r.id, quantity: li.quantity });
        liInserts.push({
          orderId: '', // tx içinde set edilir
          vendorId: r.vendorId,
          productId: r.productId,
          variantId: r.id,
          shopifyLineItemId: `native-${li.variant_id}-${i}`,
          title: li.title || r.title || 'Ürün',
          variantTitle: null,
          sku: li.sku ?? r.sku ?? null,
          quantity: li.quantity,
          unitPriceCents: unitCents,
          totalPriceCents: lineCents,
          discountCents: 0n,
          status: 'pending',
        });
      }
    });

    const shippingCents = toCents(b.shipping_cost ?? 0);
    const discountCents = toCents(b.discount_amount ?? 0);
    const codCard = method === 'cod' && b.cod_method === 'kart' && (b.cod_surcharge ?? 0) > 0;
    const codCents = codCard ? toCents(b.cod_surcharge as number) : 0n;
    const totalCents = subtotalCents + shippingCents + codCents - discountCents;
    // SON SAVUNMA (11 Ağu 2026) — Shopify yolundaki (create-storefront-order.ts) kontrolün
    // native karşılığı: indirim sepeti sıfırlıyorsa sipariş AÇILMAZ (ürün bedavaya gitmesin).
    if (discountCents > 0n && totalCents <= 0n) {
      console.error('[native-order] indirim sepeti sıfırladı — sipariş açılmadı', {
        subtotalCents: String(subtotalCents), discountCents: String(discountCents), code: b.discount_code, method,
      });
      return {
        ok: false,
        error: 'İndirim tutarı sepet toplamını karşılıyor. Lütfen kuponu kaldırıp tekrar deneyin.',
      };
    }

    const orderNumber = await nextOrderNumber();
    const codTipi = method === 'cod' ? (b.cod_method === 'kart' ? 'Kart' : 'Nakit') : '';
    const vendorIds = [...vendorIdSet];

    // 3) Transaction: order + line items + stok düşümü
    let orderId = '';
    await db.transaction(async (tx) => {
      const insertValues: typeof orders.$inferInsert = {
        shopifyOrderId: null,
        shopifyOrderName: null,
        orderNumber,
        backend: 'native',
        customerId: b.customer_id ? String(b.customer_id) : null,
        customerEmail: (b.customer_email || b.email) || null,
        customerName: `${b.first_name} ${b.last_name}`.trim() || null,
        customerPhone: b.phone || null,
        shippingAddress: {
          name: `${b.first_name} ${b.last_name}`.trim(),
          phone: b.phone,
          address1: b.address1,
          address2: b.address2 || undefined, // mahalle
          city: b.city, // ilçe
          district: b.province, // il (order-ingest konvansiyonu)
          postalCode: b.zip || undefined,
          country: 'Turkey',
          countryCode: 'TR',
        },
        subtotalCents,
        shippingCents,
        taxCents: 0n,
        discountCents,
        totalCents,
        currency: 'TRY',
        financialStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        vendorCount: vendorIds.length,
        vendorIds,
        sourceName: 'storefront_native',
        note: `📍 ${b.first_name} ${b.last_name} · ${b.province}/${b.city}\n💳 ${method === 'havale' ? 'Havale / EFT' : 'Kapıda Ödeme'}${codTipi ? ' (' + codTipi + ')' : ''}`,
        tags: [
          'via-mood-storefront',
          method === 'havale' ? 'havale-pending' : 'kapida-odeme',
          ...(codCard ? ['kapida-kart'] : []),
        ],
        placedAt: new Date(),
      };
      const [created] = await tx.insert(orders).values(insertValues).returning({ id: orders.id });
      if (!created) throw new Error('native order insert başarısız');
      orderId = created.id;

      if (liInserts.length) {
        await tx.insert(orderLineItems).values(liInserts.map((li) => ({ ...li, orderId: created.id })));
      }
      await decrementForOrder(matched, tx);
    });

    // 4) Downstream (transaction DIŞI, fire-and-forget — webhook ile aynı)
    routeOrder(orderId)
      .then(() => autoFulfillOrder(orderId))
      .catch((e) => console.error('[native-order] routing/auto-fulfill error:', e));
    // Mikro push kargo etiketi SONRASI (takip no ile, fulfillment-service) — MIKRO_PUSH_ON_ORDER=true eski davranış
    if (env.MIKRO_PUSH_ON_ORDER && env.MIKRO_AUTO_PUSH && env.MIKRO_API_URL) {
      syncOrderToMikro(orderId).catch((e) => console.error('[native-order] mikro error:', e));
    }

    // Adres defterine yapılandırılmış kayıt (FAZ 1 fonksiyonu — RDS + best-effort Shopify)
    if (b.saved_address !== '1') { // kayıtlı adres seçildiyse tekrar kaydetme (duplicate önlemi)
      upsertCustomerAddress({
        customerId: b.customer_id,
        first_name: b.first_name,
        last_name: b.last_name,
        phone: b.phone,
        address1: b.address1,
        address2: b.address2,
        city: b.city,
        province: b.province,
        zip: b.zip,
      }).catch(() => {});
    }

    // Onay e-postası (Shopify send_receipt yerine) — best-effort
    try {
      const vendors = await resolveVendorIbans(b.line_items, b.shipping_cost ?? 0);
      const tpl = orderConfirmationEmail({
        orderNumber,
        customerName: `${b.first_name} ${b.last_name}`.trim(),
        total: Number(totalCents) / 100,
        method,
        codMethod: b.cod_method,
        vendors,
      });
      const to = b.customer_email || b.email;
      if (to) await sendEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
    } catch (e) {
      console.error('[native-order] email error:', e);
    }

    return { ok: true, orderId, orderName: orderNumber, total: Number(totalCents) / 100 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * FAZ 2 Dilim 2 — Native KART siparişi (İyzico/PayTR) için ödeme-ÖNCESİ pending order.
 * Shopify draft order yerine RDS'e `pending` native order yazar. Stok düşümü YOK
 * (ödeme onaylanmadı — abandoned kart denemesi stok sızdırmasın). routing/mikro/email
 * de ÖDEME ONAYINDA (`completeNativeCardOrder`) tetiklenir.
 *
 * Dönen NUMERİK ref (orderNumber'ın rakamları, örn VM-100002 → 100002) gateway'e taşınır:
 * İyzico callback `?draft=<ref>`, PayTR merchant_oid `vm<ref>t<uniq>` (regex /^vm(\d+)t/).
 * Callback'te `VM-<ref>` ile bulunup paid'e çevrilir.
 */
export async function createNativeCardPendingOrder(b: StorefrontOrderBody): Promise<number | null> {
  try {
    const variantIds = b.line_items.map((li) => String(li.variant_id)).filter(Boolean);
    const vRows = variantIds.length
      ? await db
          .select({
            shopifyVariantId: productVariants.shopifyVariantId,
            id: productVariants.id,
            productId: productVariants.productId,
            vendorId: productVariants.vendorId,
            priceCents: productVariants.priceCents,
            title: productVariants.title,
            sku: productVariants.sku,
          })
          .from(productVariants)
          .where(inArray(productVariants.shopifyVariantId, variantIds))
      : [];
    const byVariant = new Map(vRows.map((r) => [r.shopifyVariantId, r]));

    let subtotalCents = 0n;
    const vendorIdSet = new Set<string>();
    const liInserts: Array<typeof orderLineItems.$inferInsert> = [];
    b.line_items.forEach((li, i) => {
      const r = byVariant.get(String(li.variant_id));
      const unitCents = r?.priceCents != null ? BigInt(r.priceCents) : toCents(li.price ?? 0);
      const lineCents = unitCents * BigInt(li.quantity);
      subtotalCents += lineCents;
      if (r?.vendorId) {
        vendorIdSet.add(r.vendorId);
        liInserts.push({
          orderId: '',
          vendorId: r.vendorId,
          productId: r.productId,
          variantId: r.id,
          shopifyLineItemId: `native-${li.variant_id}-${i}`,
          title: li.title || r.title || 'Ürün',
          variantTitle: null,
          sku: li.sku ?? r.sku ?? null,
          quantity: li.quantity,
          unitPriceCents: unitCents,
          totalPriceCents: lineCents,
          discountCents: 0n,
          status: 'pending',
        });
      }
    });

    const shippingCents = toCents(b.shipping_cost ?? 0);
    const discountCents = toCents(b.discount_amount ?? 0);
    const totalCents = subtotalCents + shippingCents - discountCents;
    const orderNumber = await nextOrderNumber();
    const vendorIds = [...vendorIdSet];

    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(orders)
        .values({
          shopifyOrderId: null,
          shopifyOrderName: null,
          orderNumber,
          backend: 'native',
          customerId: b.customer_id ? String(b.customer_id) : null,
          customerEmail: (b.customer_email || b.email) || null,
          customerName: `${b.first_name} ${b.last_name}`.trim() || null,
          customerPhone: b.phone || null,
          shippingAddress: {
            name: `${b.first_name} ${b.last_name}`.trim(),
            phone: b.phone,
            address1: b.address1,
            address2: b.address2 || undefined,
            city: b.city,
            district: b.province,
            postalCode: b.zip || undefined,
            country: 'Turkey',
            countryCode: 'TR',
          },
          subtotalCents,
          shippingCents,
          taxCents: 0n,
          discountCents,
          totalCents,
          currency: 'TRY',
          financialStatus: 'pending',
          fulfillmentStatus: 'unfulfilled',
          vendorCount: vendorIds.length,
          vendorIds,
          sourceName: 'storefront_native_card',
          note: `📍 ${b.first_name} ${b.last_name} · ${b.province}/${b.city}\n💳 Kart (İyzico/PayTR) — ödeme bekleniyor`,
          tags: ['via-mood-storefront', 'card-pending'],
          placedAt: new Date(),
        })
        .returning({ id: orders.id });
      if (!created) throw new Error('native card order insert başarısız');
      if (liInserts.length) {
        await tx.insert(orderLineItems).values(liInserts.map((li) => ({ ...li, orderId: created.id })));
      }
      // Stok düşümü YOK — ödeme onayında (completeNativeCardOrder)
    });

    return Number(orderNumber.replace(/\D/g, '')) || null; // VM-100002 → 100002
  } catch (e) {
    console.error('[native-card] pending error:', e);
    return null;
  }
}

/**
 * Native KART siparişini ödeme onayında tamamlar (İyzico/PayTR callback). Idempotent
 * (PayTR retry / İyzico tekrar). numericRef = orderNumber rakamları → `VM-<ref>` lookup.
 * Stok düşümü + paid + komisyon + routing/mikro + onay e-postası ÖDEME ONAYINDA olur.
 */
export async function completeNativeCardOrder(numericRef: string): Promise<boolean> {
  try {
    const orderNumber = `VM-${numericRef}`;
    const [o] = await db
      .select({
        id: orders.id,
        email: orders.customerEmail,
        name: orders.customerName,
        total: orders.totalCents,
        fin: orders.financialStatus,
      })
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);
    if (!o) {
      console.error('[native-card] complete: order yok', orderNumber);
      return false;
    }
    if (o.fin === 'paid') return true; // idempotent

    // Stok düşümü (ödeme onaylandı)
    const lis = await db
      .select({
        vendorId: orderLineItems.vendorId,
        variantId: orderLineItems.variantId,
        quantity: orderLineItems.quantity,
      })
      .from(orderLineItems)
      .where(eq(orderLineItems.orderId, o.id));
    const matched = lis
      .filter((l) => l.vendorId && l.variantId)
      .map((l) => ({ vendorId: l.vendorId as string, variantId: l.variantId as string, quantity: l.quantity }));
    if (matched.length) {
      await db.transaction(async (tx) => {
        await decrementForOrder(matched, tx);
      });
    }

    // paid + komisyon (idempotent)
    await markOrderPaid(o.id);

    // Downstream (fire-and-forget)
    routeOrder(o.id)
      .then(() => autoFulfillOrder(o.id))
      .catch((e) => console.error('[native-card] routing/auto-fulfill:', e));
    // Mikro push kargo etiketi SONRASI (takip no ile, fulfillment-service) — MIKRO_PUSH_ON_ORDER=true eski davranış
    if (env.MIKRO_PUSH_ON_ORDER && env.MIKRO_AUTO_PUSH && env.MIKRO_API_URL) {
      syncOrderToMikro(o.id).catch((e) => console.error('[native-card] mikro:', e));
    }

    // Onay e-postası (kart — ödeme alındı)
    try {
      const tpl = orderConfirmationEmail({
        orderNumber,
        customerName: o.name ?? '',
        total: Number(o.total) / 100,
        method: 'card',
        vendors: [],
      });
      if (o.email) await sendEmail({ to: o.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    } catch (e) {
      console.error('[native-card] email:', e);
    }

    return true;
  } catch (e) {
    console.error('[native-card] complete error:', e);
    return false;
  }
}
