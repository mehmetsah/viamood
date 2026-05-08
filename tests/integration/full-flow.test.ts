/**
 * Full-flow integration test — full vendor lifecycle.
 *
 * Gerçek Postgres DB'ye karşı çalışır (lokalin viamood_vendor).
 * Test verisini "test_<runId>_..." prefix'iyle yaratır, sonunda cleanup eder.
 *
 * Run: npm test -- tests/integration
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, eq, and, inArray } from 'drizzle-orm';

// IMPORTANT: vitest çalışırken NODE_ENV otomatik test olur — DB env'i set etmemiz lazım
process.env.DATABASE_URL ??= 'postgres://mehmetsah@localhost:5432/viamood_vendor';
process.env.AUTH_SECRET ??= 'test-secret-at-least-32-characters-long-padding';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.SHOPIFY_STORE_DOMAIN ??= 'via-mood.myshopify.com';

const { db } = await import('../../src/db/client');
const schema = await import('../../src/db/schema');
const { hashPassword } = await import('../../src/lib/password');
const { routeOrder } = await import('../../src/lib/routing/engine');

const RUN_ID = `t${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const testEmail = (n: string) => `${RUN_ID}_${n}@test.local`;

interface TestState {
  adminUserId: string;
  vendorUserIds: string[];
  vendorIds: string[];
  productIds: string[];
  variantIds: string[];
  orderIds: string[];
  payoutIds: string[];
  ruleIds: string[];
}

const state: TestState = {
  adminUserId: '',
  vendorUserIds: [],
  vendorIds: [],
  productIds: [],
  variantIds: [],
  orderIds: [],
  payoutIds: [],
  ruleIds: [],
};

beforeAll(async () => {
  // Sanity: DB bağlantısı
  const result = await db.execute(sql`SELECT 1 as ok`);
  expect(result).toBeTruthy();
});

afterAll(async () => {
  // Cleanup — yarattığımız her şeyi sırayla sil (FK'ler nedeniyle order önemli)
  if (state.payoutIds.length > 0) {
    await db.delete(schema.payouts).where(inArray(schema.payouts.id, state.payoutIds));
  }
  if (state.orderIds.length > 0) {
    await db
      .delete(schema.commissionLedger)
      .where(inArray(schema.commissionLedger.orderId, state.orderIds));
    await db
      .delete(schema.routingDecisions)
      .where(inArray(schema.routingDecisions.orderId, state.orderIds));
    await db
      .delete(schema.orderEvents)
      .where(inArray(schema.orderEvents.orderId, state.orderIds));
    await db
      .delete(schema.orderLineItems)
      .where(inArray(schema.orderLineItems.orderId, state.orderIds));
    await db.delete(schema.orders).where(inArray(schema.orders.id, state.orderIds));
  }
  if (state.ruleIds.length > 0) {
    await db.delete(schema.routingRules).where(inArray(schema.routingRules.id, state.ruleIds));
  }
  if (state.variantIds.length > 0) {
    await db
      .delete(schema.inventoryLevels)
      .where(inArray(schema.inventoryLevels.variantId, state.variantIds));
    await db
      .delete(schema.productVariants)
      .where(inArray(schema.productVariants.id, state.variantIds));
  }
  if (state.productIds.length > 0) {
    await db.delete(schema.products).where(inArray(schema.products.id, state.productIds));
  }
  if (state.vendorIds.length > 0) {
    await db
      .delete(schema.vendorMemberships)
      .where(inArray(schema.vendorMemberships.vendorId, state.vendorIds));
    await db.delete(schema.vendors).where(inArray(schema.vendors.id, state.vendorIds));
  }
  const allUserIds = [state.adminUserId, ...state.vendorUserIds].filter(Boolean);
  if (allUserIds.length > 0) {
    await db.delete(schema.users).where(inArray(schema.users.id, allUserIds));
  }
});

describe('1. User & Vendor lifecycle', () => {
  it('admin user oluştur', async () => {
    const passwordHash = await hashPassword('Admin1234');
    const [admin] = await db
      .insert(schema.users)
      .values({
        email: testEmail('admin'),
        name: 'Test Admin',
        passwordHash,
        role: 'super_admin',
      })
      .returning({ id: schema.users.id });
    expect(admin?.id).toBeTruthy();
    state.adminUserId = admin!.id;
  });

  it('iki vendor user + iki vendor (cari + marketplace) yarat', async () => {
    for (let i = 0; i < 2; i++) {
      const passwordHash = await hashPassword('Vendor1234');
      const [user] = await db
        .insert(schema.users)
        .values({
          email: testEmail(`vendor${i}`),
          name: `Test Vendor ${i}`,
          passwordHash,
          role: 'vendor_admin',
        })
        .returning({ id: schema.users.id });
      state.vendorUserIds.push(user!.id);

      const [vendor] = await db
        .insert(schema.vendors)
        .values({
          slug: `test-vendor-${RUN_ID}-${i}`,
          name: `Test Vendor ${i}`,
          legalName: `Test Vendor ${i} Ltd.`,
          email: testEmail(`vendor${i}`),
          taxId: `99999999${i}9`,
          taxOffice: 'Test',
          status: 'active',
          commissionRate: i === 0 ? 0 : 1000, // %0 ve %10
          paymentMode: i === 0 ? 'cari' : 'marketplace_split',
          iban: `TR0000000000000000000000${i}0`,
          accountHolderName: `Test Vendor ${i} Ltd.`,
        })
        .returning({ id: schema.vendors.id });
      state.vendorIds.push(vendor!.id);

      await db.insert(schema.vendorMemberships).values({
        userId: user!.id,
        vendorId: vendor!.id,
        role: 'owner',
        acceptedAt: new Date(),
      });
    }
    expect(state.vendorIds).toHaveLength(2);
  });
});

describe('2. Product + inventory', () => {
  it('her vendor için 2 ürün + variant + stok yarat', async () => {
    for (let vi = 0; vi < state.vendorIds.length; vi++) {
      const vendorId = state.vendorIds[vi]!;
      for (let pi = 0; pi < 2; pi++) {
        const [product] = await db
          .insert(schema.products)
          .values({
            vendorId,
            shopifyProductId: `test_p_${RUN_ID}_${vi}_${pi}`,
            shopifyHandle: `test-product-${vi}-${pi}`,
            title: `Test Ürün V${vi}-P${pi}`,
            status: 'active',
            vendorSlug: `test-vendor-${RUN_ID}-${vi}`,
            vendorName: `Test Vendor ${vi}`,
            minPriceCents: BigInt(10000 * (pi + 1)),
            maxPriceCents: BigInt(10000 * (pi + 1)),
            totalInventory: 100,
          })
          .returning({ id: schema.products.id });
        state.productIds.push(product!.id);

        const [variant] = await db
          .insert(schema.productVariants)
          .values({
            productId: product!.id,
            vendorId,
            shopifyVariantId: `test_v_${RUN_ID}_${vi}_${pi}`,
            title: 'Default',
            sku: `SKU-${vi}-${pi}`,
            priceCents: BigInt(10000 * (pi + 1)),
          })
          .returning({ id: schema.productVariants.id });
        state.variantIds.push(variant!.id);

        await db.insert(schema.inventoryLevels).values({
          vendorId,
          variantId: variant!.id,
          quantity: 100,
          available: 100,
        });
      }
    }
    expect(state.productIds).toHaveLength(4);
    expect(state.variantIds).toHaveLength(4);
  });

  it('inventory atomic adjust çalışır', async () => {
    const variantId = state.variantIds[0]!;
    await db
      .update(schema.inventoryLevels)
      .set({
        quantity: sql`${schema.inventoryLevels.quantity} - 5`,
        available: sql`${schema.inventoryLevels.available} - 5`,
        version: sql`${schema.inventoryLevels.version} + 1`,
      })
      .where(eq(schema.inventoryLevels.variantId, variantId));

    const [row] = await db
      .select()
      .from(schema.inventoryLevels)
      .where(eq(schema.inventoryLevels.variantId, variantId))
      .limit(1);
    expect(row!.quantity).toBe(95);
    expect(row!.available).toBe(95);
    expect(row!.version).toBe(2);
  });
});

describe('3. Routing rule', () => {
  it('İstanbul → consolidate_self kuralı yarat', async () => {
    const [rule] = await db
      .insert(schema.routingRules)
      .values({
        name: `[${RUN_ID}] Istanbul consolidate`,
        priority: 100,
        action: 'consolidate_self',
        conditions: {
          all: [
            { field: 'shipping.city', op: 'eq', value: 'İstanbul' },
            { field: 'vendor_count', op: '>=', value: 2 },
          ],
        },
        enabled: true,
      })
      .returning({ id: schema.routingRules.id });
    state.ruleIds.push(rule!.id);
    expect(rule?.id).toBeTruthy();
  });
});

describe('4. Order creation + routing', () => {
  it('iki vendor karışık order yarat, routing engine consolidate_self vermeli', async () => {
    const orderTotalCents = 30000n;
    const [order] = await db
      .insert(schema.orders)
      .values({
        shopifyOrderId: `test_o_${RUN_ID}_1`,
        shopifyOrderName: `#TEST-${RUN_ID}-1`,
        customerName: 'Test Customer',
        customerEmail: testEmail('customer'),
        shippingAddress: {
          name: 'Test Customer',
          address1: 'Test Sk. 1',
          city: 'İstanbul',
          district: 'Beyoğlu',
          country: 'TR',
        },
        subtotalCents: orderTotalCents,
        totalCents: orderTotalCents,
        currency: 'TRY',
        financialStatus: 'paid',
        sourceName: 'integration_test',
        placedAt: new Date(),
      })
      .returning({ id: schema.orders.id });
    state.orderIds.push(order!.id);

    // 2 line item — biri her vendor'dan
    for (let i = 0; i < 2; i++) {
      const variantId = state.variantIds[i * 2]!; // her vendor'ın ilk ürünü
      const vendorId = state.vendorIds[i]!;
      const priceCents = BigInt(10000); // ilk ürünün fiyatı
      await db.insert(schema.orderLineItems).values({
        orderId: order!.id,
        vendorId,
        variantId,
        shopifyLineItemId: `test_li_${RUN_ID}_${i}`,
        title: `Test Ürün V${i}-P0`,
        sku: `SKU-${i}-0`,
        quantity: 1,
        unitPriceCents: priceCents,
        totalPriceCents: priceCents,
        status: 'pending',
      });

      // Commission ledger (manuel, gerçek action yapsın diye)
      const commissionRateBps = i === 0 ? 0 : 1000;
      const commissionAmt = (priceCents * BigInt(commissionRateBps)) / 10000n;
      await db.insert(schema.commissionLedger).values({
        vendorId,
        orderId: order!.id,
        type: 'sale',
        status: 'accrued',
        grossAmountCents: priceCents,
        commissionRateBps,
        commissionAmountCents: commissionAmt,
        payoutAmountCents: priceCents - commissionAmt,
      });
    }

    // Routing engine
    const result = await routeOrder(order!.id);
    expect(result.mode).toBe('consolidate_self');
    expect(result.matchedRuleName).toContain('Istanbul consolidate');
    expect(result.assignments).toHaveLength(2);
  });

  it('idempotent: aynı order tekrar route edilirse cached döner', async () => {
    const orderId = state.orderIds[0]!;
    const result = await routeOrder(orderId);
    expect(result.reason).toBe('cached');
  });

  it('tek vendor order → split (default)', async () => {
    const variantId = state.variantIds[0]!;
    const vendorId = state.vendorIds[0]!;
    const [order] = await db
      .insert(schema.orders)
      .values({
        shopifyOrderId: `test_o_${RUN_ID}_2`,
        shopifyOrderName: `#TEST-${RUN_ID}-2`,
        customerName: 'Single Vendor',
        customerEmail: testEmail('single'),
        shippingAddress: { city: 'Ankara', country: 'TR' },
        subtotalCents: 10000n,
        totalCents: 10000n,
        currency: 'TRY',
        financialStatus: 'paid',
        sourceName: 'integration_test',
        placedAt: new Date(),
      })
      .returning({ id: schema.orders.id });
    state.orderIds.push(order!.id);

    await db.insert(schema.orderLineItems).values({
      orderId: order!.id,
      vendorId,
      variantId,
      shopifyLineItemId: `test_li_${RUN_ID}_solo`,
      title: 'Test Solo',
      quantity: 1,
      unitPriceCents: 10000n,
      totalPriceCents: 10000n,
      status: 'pending',
    });

    const result = await routeOrder(order!.id);
    expect(result.mode).toBe('split');
    expect(result.matchedRuleName).toBe('Single vendor (default)');
  });
});

describe('5. Payout batch', () => {
  it('vendor1 (marketplace_split, %10) için ledger entry var', async () => {
    const vendorId = state.vendorIds[1]!;
    const rows = await db
      .select()
      .from(schema.commissionLedger)
      .where(
        and(
          eq(schema.commissionLedger.vendorId, vendorId),
          eq(schema.commissionLedger.status, 'accrued'),
        ),
      );
    expect(rows.length).toBeGreaterThan(0);
    const entry = rows[0]!;
    expect(entry.commissionRateBps).toBe(1000);
    // 10000 cents × %10 = 1000 commission, 9000 payout
    expect(Number(entry.commissionAmountCents)).toBe(1000);
    expect(Number(entry.payoutAmountCents)).toBe(9000);
  });

  it('vendor0 (cari, %0) için commission 0 olmalı', async () => {
    const vendorId = state.vendorIds[0]!;
    const rows = await db
      .select()
      .from(schema.commissionLedger)
      .where(
        and(
          eq(schema.commissionLedger.vendorId, vendorId),
          eq(schema.commissionLedger.status, 'accrued'),
        ),
      );
    expect(rows.length).toBeGreaterThan(0);
    for (const e of rows) {
      expect(Number(e.commissionAmountCents)).toBe(0);
      expect(e.payoutAmountCents).toEqual(e.grossAmountCents);
    }
  });

  it('payout batch yarat: vendor0 için tüm accrued ledger', async () => {
    const vendorId = state.vendorIds[0]!;
    const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [agg] = await db
      .select({
        gross: sql<string>`COALESCE(SUM(${schema.commissionLedger.grossAmountCents}), 0)::text`,
        commission: sql<string>`COALESCE(SUM(${schema.commissionLedger.commissionAmountCents}), 0)::text`,
        payout: sql<string>`COALESCE(SUM(${schema.commissionLedger.payoutAmountCents}), 0)::text`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(schema.commissionLedger)
      .where(
        and(
          eq(schema.commissionLedger.vendorId, vendorId),
          eq(schema.commissionLedger.status, 'accrued'),
        ),
      );

    expect(agg!.count).toBeGreaterThan(0);

    const [payout] = await db
      .insert(schema.payouts)
      .values({
        vendorId,
        method: 'manual_bank',
        status: 'draft',
        periodStart,
        periodEnd,
        grossAmountCents: BigInt(agg!.gross),
        commissionAmountCents: BigInt(agg!.commission),
        netAmountCents: BigInt(agg!.payout),
      })
      .returning({ id: schema.payouts.id });
    state.payoutIds.push(payout!.id);

    await db
      .update(schema.commissionLedger)
      .set({ payoutBatchId: payout!.id })
      .where(
        and(
          eq(schema.commissionLedger.vendorId, vendorId),
          eq(schema.commissionLedger.status, 'accrued'),
        ),
      );

    expect(payout?.id).toBeTruthy();
  });

  it('payout paid mark → ledger paid + vendor totalPayout artar', async () => {
    const payoutId = state.payoutIds[0]!;
    const [p] = await db.select().from(schema.payouts).where(eq(schema.payouts.id, payoutId)).limit(1);
    const netAmount = p!.netAmountCents;

    await db
      .update(schema.payouts)
      .set({ status: 'paid', paidAt: new Date() })
      .where(eq(schema.payouts.id, payoutId));

    await db
      .update(schema.commissionLedger)
      .set({ status: 'paid' })
      .where(eq(schema.commissionLedger.payoutBatchId, payoutId));

    await db
      .update(schema.vendors)
      .set({
        totalPayoutCents: sql`${schema.vendors.totalPayoutCents} + ${netAmount}`,
      })
      .where(eq(schema.vendors.id, p!.vendorId));

    const [vendor] = await db
      .select({ totalPayoutCents: schema.vendors.totalPayoutCents })
      .from(schema.vendors)
      .where(eq(schema.vendors.id, p!.vendorId))
      .limit(1);
    expect(Number(vendor!.totalPayoutCents)).toBeGreaterThanOrEqual(Number(netAmount));

    const ledgerCheck = await db
      .select({ status: schema.commissionLedger.status })
      .from(schema.commissionLedger)
      .where(eq(schema.commissionLedger.payoutBatchId, payoutId));
    expect(ledgerCheck.every((l) => l.status === 'paid')).toBe(true);
  });
});

describe('6. Sanity', () => {
  it('routing decision DB\'de saklı', async () => {
    const orderId = state.orderIds[0]!;
    const [decision] = await db
      .select()
      .from(schema.routingDecisions)
      .where(eq(schema.routingDecisions.orderId, orderId))
      .limit(1);
    expect(decision?.mode).toBe('consolidate_self');
  });

  it('order events log kayıtlı', async () => {
    const orderId = state.orderIds[0]!;
    const events = await db
      .select()
      .from(schema.orderEvents)
      .where(eq(schema.orderEvents.orderId, orderId));
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.eventType === 'order_routed')).toBe(true);
  });

  it('idempotency: routing decision unique on order', async () => {
    const orderId = state.orderIds[0]!;
    const decisions = await db
      .select()
      .from(schema.routingDecisions)
      .where(eq(schema.routingDecisions.orderId, orderId));
    expect(decisions).toHaveLength(1);
  });
});
