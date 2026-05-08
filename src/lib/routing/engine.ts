/**
 * Routing engine — çekirdek karar motoru.
 *
 * Kullanım:
 *   const result = await routeOrder(orderId);
 *   // result.mode → split | consolidate_self | consolidate_carrier
 *   // result.assignments → her vendor'a hangi line item'lar
 *
 * Idempotent — aynı orderId 2. kez routeOrder edilirse mevcut kararı döndürür.
 */
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  orderEvents,
  orderLineItems,
  orders,
  routingDecisions,
  routingRules,
} from '@/db/schema';
import { evaluate } from './evaluator';
import type {
  ConditionTree,
  FulfillmentMode,
  OrderContext,
  RoutingResult,
  VendorAssignment,
} from './types';

export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`);
  }
}

async function buildContext(orderId: string): Promise<{
  ctx: OrderContext;
  lineItemsByVendor: Map<string, string[]>;
}> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new OrderNotFoundError(orderId);

  const items = await db
    .select()
    .from(orderLineItems)
    .where(eq(orderLineItems.orderId, orderId));

  const lineItemsByVendor = new Map<string, string[]>();
  for (const it of items) {
    const arr = lineItemsByVendor.get(it.vendorId) ?? [];
    arr.push(it.id);
    lineItemsByVendor.set(it.vendorId, arr);
  }

  const ctx: OrderContext = {
    total_cents: Number(order.totalCents),
    subtotal_cents: Number(order.subtotalCents),
    shipping_cents: Number(order.shippingCents),
    currency: order.currency,
    vendor_count: lineItemsByVendor.size,
    vendor_ids: Array.from(lineItemsByVendor.keys()),
    line_item_count: items.length,
    total_weight_grams: 0, // TODO: variant'lardan hesapla, Phase 4
    shipping: order.shippingAddress
      ? {
          city: order.shippingAddress.city,
          district: order.shippingAddress.district,
          country: order.shippingAddress.country,
          postal_code: order.shippingAddress.postalCode,
        }
      : undefined,
    customer: {
      email: order.customerEmail ?? undefined,
    },
    tags: order.tags ?? [],
  };

  return { ctx, lineItemsByVendor };
}

export async function routeOrder(orderId: string): Promise<RoutingResult> {
  // Idempotent — varolan kararı döndür
  const [existing] = await db
    .select()
    .from(routingDecisions)
    .where(eq(routingDecisions.orderId, orderId))
    .limit(1);

  if (existing) {
    return {
      mode: existing.mode,
      matchedRuleId: existing.matchedRuleId ?? null,
      matchedRuleName: null,
      assignments: existing.assignments as VendorAssignment[],
      reason: 'cached',
    };
  }

  const { ctx, lineItemsByVendor } = await buildContext(orderId);

  // Tek vendor → split (default)
  if (ctx.vendor_count <= 1) {
    return saveDecision(orderId, {
      mode: 'split',
      matchedRuleId: null,
      matchedRuleName: 'Single vendor (default)',
      assignments: Array.from(lineItemsByVendor.entries()).map(([vendorId, ids]) => ({
        vendorId,
        lineItemIds: ids,
      })),
      reason: 'single-vendor',
    });
  }

  // Aktif kuralları priority sırasıyla al
  const rules = await db
    .select()
    .from(routingRules)
    .where(eq(routingRules.enabled, true))
    .orderBy(asc(routingRules.priority));

  let matched: { id: string; name: string; mode: FulfillmentMode } | null = null;
  for (const rule of rules) {
    const tree = rule.conditions as unknown as ConditionTree;
    if (evaluate(tree, ctx)) {
      matched = { id: rule.id, name: rule.name, mode: rule.action };

      // İstatistik artır (best-effort, hata durumunda yutar)
      void db
        .update(routingRules)
        .set({
          timesMatched: BigInt(rule.timesMatched) + 1n,
          lastMatchedAt: new Date().toISOString(),
        })
        .where(eq(routingRules.id, rule.id))
        .catch(() => undefined);

      break;
    }
  }

  // Kural eşleşmediyse default: split
  const finalMode: FulfillmentMode = matched?.mode ?? 'split';

  const assignments: VendorAssignment[] = Array.from(lineItemsByVendor.entries()).map(
    ([vendorId, ids]) => ({
      vendorId,
      lineItemIds: ids,
    }),
  );

  return saveDecision(orderId, {
    mode: finalMode,
    matchedRuleId: matched?.id ?? null,
    matchedRuleName: matched?.name ?? null,
    assignments,
    reason: matched ? `matched-rule:${matched.name}` : 'default-split',
  });
}

async function saveDecision(orderId: string, result: RoutingResult): Promise<RoutingResult> {
  await db.transaction(async (tx) => {
    await tx
      .insert(routingDecisions)
      .values({
        orderId,
        matchedRuleId: result.matchedRuleId,
        mode: result.mode,
        assignments: result.assignments,
      })
      .onConflictDoNothing({ target: routingDecisions.orderId });

    // Her line item'ın fulfillment mode'unu set et
    for (const a of result.assignments) {
      const mode = a.modeOverride ?? result.mode;
      for (const lineItemId of a.lineItemIds) {
        await tx
          .update(orderLineItems)
          .set({
            fulfillmentMode: mode,
            assignedAt: new Date(),
            status: 'awaiting_pickup',
          })
          .where(eq(orderLineItems.id, lineItemId));
      }
    }

    // Order'da vendorIds güncelle
    await tx
      .update(orders)
      .set({
        vendorCount: result.assignments.length,
        vendorIds: result.assignments.map((a) => a.vendorId),
      })
      .where(eq(orders.id, orderId));

    // Event log
    await tx.insert(orderEvents).values({
      orderId,
      eventType: 'order_routed',
      payload: {
        mode: result.mode,
        matchedRuleId: result.matchedRuleId,
        matchedRuleName: result.matchedRuleName,
        assignments: result.assignments,
        reason: result.reason,
      },
      actorType: 'system',
      actorId: 'routing-engine',
    });
  });

  return result;
}
