'use server';

import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  inventoryLevels,
  orderEvents,
  orderLineItems,
  orders,
  productVariants,
  products,
  vendors,
} from '@/db/schema';
import { auth } from '@/lib/auth';
import { routeOrder } from '@/lib/routing/engine';

async function requireAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'admin' && role !== 'super_admin')) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

const lineItemInputSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10000),
});

const createOrderSchema = z.object({
  customerName: z.string().min(2).max(120),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(10).max(20).optional().or(z.literal('')),
  city: z.string().min(2).max(60),
  district: z.string().min(2).max(60),
  addressLine1: z.string().min(5).max(200),
  postalCode: z.string().max(10).optional().or(z.literal('')),
  shippingCents: z.number().int().min(0).default(0),
  lineItems: z.array(lineItemInputSchema).min(1, 'En az 1 ürün ekle'),
});

function genShopifyOrderId() {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function genShopifyOrderName() {
  return `#TEST-${Math.floor(Math.random() * 90000) + 10000}`;
}

/**
 * Admin için manuel test order oluşturma.
 * Phase 2.3'te Shopify webhook'tan otomatik gelecek.
 * Şimdi form ile elle yaratabiliyoruz.
 */
export async function createTestOrderAction(formData: FormData): Promise<void> {
  await requireAdmin();

  // Line items field'larını parse et: lineItems[N].variantId, lineItems[N].quantity
  const lineItems: Array<{ variantId: string; quantity: number }> = [];
  for (let i = 0; i < 50; i++) {
    const variantId = formData.get(`lineItems[${i}].variantId`);
    const quantity = formData.get(`lineItems[${i}].quantity`);
    if (!variantId || !quantity) continue;
    lineItems.push({
      variantId: String(variantId),
      quantity: Number(quantity),
    });
  }

  const data = createOrderSchema.parse({
    customerName: String(formData.get('customerName') ?? ''),
    customerEmail: String(formData.get('customerEmail') ?? '').toLowerCase().trim(),
    customerPhone: String(formData.get('customerPhone') ?? '').trim(),
    city: String(formData.get('city') ?? ''),
    district: String(formData.get('district') ?? ''),
    addressLine1: String(formData.get('addressLine1') ?? ''),
    postalCode: String(formData.get('postalCode') ?? '').trim(),
    shippingCents: Math.round(Number(formData.get('shipping') ?? 0) * 100),
    lineItems,
  });

  // Variant'ları çek (vendor + price)
  const variantIds = data.lineItems.map((li) => li.variantId);
  const variantRows = await db
    .select({
      variantId: productVariants.id,
      vendorId: productVariants.vendorId,
      productId: productVariants.productId,
      productTitle: products.title,
      variantTitle: productVariants.title,
      sku: productVariants.sku,
      priceCents: productVariants.priceCents,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(sql`${productVariants.id} = ANY(${variantIds}::uuid[])`);

  const variantMap = new Map(variantRows.map((v) => [v.variantId, v]));

  // Subtotal hesapla
  let subtotalCents = 0n;
  for (const li of data.lineItems) {
    const v = variantMap.get(li.variantId);
    if (!v) throw new Error(`Variant bulunamadı: ${li.variantId}`);
    subtotalCents += BigInt(v.priceCents) * BigInt(li.quantity);
  }
  const totalCents = subtotalCents + BigInt(data.shippingCents);

  let orderId = '';

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(orders)
      .values({
        shopifyOrderId: genShopifyOrderId(),
        shopifyOrderName: genShopifyOrderName(),
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone || null,
        shippingAddress: {
          name: data.customerName,
          phone: data.customerPhone,
          address1: data.addressLine1,
          city: data.city,
          district: data.district,
          postalCode: data.postalCode,
          country: 'TR',
          countryCode: 'TR',
        },
        subtotalCents,
        shippingCents: BigInt(data.shippingCents),
        totalCents,
        currency: 'TRY',
        financialStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        sourceName: 'admin_test',
        placedAt: new Date(),
      })
      .returning({ id: orders.id });

    if (!created) throw new Error('Order oluşturulamadı');
    orderId = created.id;

    // Line item'ları yaz
    const allVendorIds = new Set<string>();
    for (let i = 0; i < data.lineItems.length; i++) {
      const li = data.lineItems[i]!;
      const v = variantMap.get(li.variantId)!;
      allVendorIds.add(v.vendorId);

      const totalPrice = BigInt(v.priceCents) * BigInt(li.quantity);
      await tx.insert(orderLineItems).values({
        orderId: created.id,
        vendorId: v.vendorId,
        productId: v.productId,
        variantId: v.variantId,
        shopifyLineItemId: `test_li_${i}_${Date.now()}`,
        title: v.productTitle,
        variantTitle: v.variantTitle,
        sku: v.sku,
        quantity: li.quantity,
        unitPriceCents: BigInt(v.priceCents),
        totalPriceCents: totalPrice,
        status: 'pending',
      });

      // Stok rezerve et (mevcut available'dan düş)
      await tx
        .update(inventoryLevels)
        .set({
          reserved: sql`${inventoryLevels.reserved} + ${li.quantity}`,
          available: sql`GREATEST(0, ${inventoryLevels.available} - ${li.quantity})`,
          version: sql`${inventoryLevels.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(inventoryLevels.variantId, v.variantId));
    }

    // Vendor counter güncelle
    for (const vid of allVendorIds) {
      await tx
        .update(vendors)
        .set({
          activeOrderCount: sql`${vendors.activeOrderCount} + 1`,
          totalRevenueCents: sql`${vendors.totalRevenueCents} + ${subtotalCents}`,
        })
        .where(eq(vendors.id, vid));
    }

    // Order event
    await tx.insert(orderEvents).values({
      orderId: created.id,
      eventType: 'order_created',
      payload: { source: 'admin_test', vendor_count: allVendorIds.size },
      actorType: 'admin',
      actorId: 'test-seeder',
    });
  });

  // Routing engine'i tetikle
  await routeOrder(orderId);

  revalidatePath('/admin/orders');
  redirect(`/admin/orders/${orderId}`);
}
