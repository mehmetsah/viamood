/**
 * Shopify fulfillmentCreate ile KargoLab tracking bilgisini Shopify'a yansıt.
 *
 * Akış:
 *   1. Order'ın fulfillmentOrders'ını çek
 *   2. Bizim line items'lar için fulfillmentOrderLineItems eşleştir (shopify_line_item_id ile)
 *   3. fulfillmentCreate(input: { trackingInfo, lineItemsByFulfillmentOrder })
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  fulfillmentLineItems,
  fulfillments,
  orderLineItems,
  orders,
} from '@/db/schema';
import { shopifyGraphQL } from './client';

interface FOQueryResp {
  order: {
    id: string;
    fulfillmentOrders: {
      edges: Array<{
        node: {
          id: string;
          status: string;
          lineItems: {
            edges: Array<{
              node: {
                id: string; // FulfillmentOrderLineItem ID
                lineItem: { id: string }; // OriginalLineItem ID
                remainingQuantity: number;
              };
            }>;
          };
        };
      }>;
    };
  } | null;
}

const FO_QUERY = /* GraphQL */ `
  query OrderFOs($id: ID!) {
    order(id: $id) {
      id
      fulfillmentOrders(first: 20) {
        edges {
          node {
            id
            status
            lineItems(first: 50) {
              edges {
                node {
                  id
                  lineItem { id }
                  remainingQuantity
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface FCResp {
  fulfillmentCreate: {
    fulfillment: {
      id: string;
      status: string;
      trackingInfo: Array<{ number: string | null; url: string | null }>;
    } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

const FC_MUTATION = /* GraphQL */ `
  mutation FC($fulfillment: FulfillmentInput!) {
    fulfillmentCreate(fulfillment: $fulfillment) {
      fulfillment {
        id
        status
        trackingInfo {
          number
          url
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const COMPANY_FROM_CARRIER: Record<string, string> = {
  PTT: 'PTT',
  ARAS: 'Aras Kargo',
  MNG: 'MNG Kargo',
  YURTICI: 'Yurtiçi Kargo',
  SURAT: 'Sürat Kargo',
};

interface PushOk {
  ok: true;
  shopifyFulfillmentId: string;
}
interface PushErr {
  ok: false;
  error: string;
}
export type PushFulfillmentResult = PushOk | PushErr;

export async function pushFulfillmentToShopify(
  fulfillmentId: string,
): Promise<PushFulfillmentResult> {
  const [f] = await db
    .select({
      id: fulfillments.id,
      orderId: fulfillments.orderId,
      vendorId: fulfillments.vendorId,
      carrier: fulfillments.carrier,
      trackingNumber: fulfillments.trackingNumber,
      trackingUrl: fulfillments.trackingUrl,
      shopifyFulfillmentId: fulfillments.shopifyFulfillmentId,
    })
    .from(fulfillments)
    .where(eq(fulfillments.id, fulfillmentId))
    .limit(1);
  if (!f) return { ok: false, error: 'Fulfillment bulunamadı' };
  if (f.shopifyFulfillmentId) {
    return { ok: true, shopifyFulfillmentId: f.shopifyFulfillmentId };
  }

  const [order] = await db
    .select({ id: orders.id, shopifyOrderId: orders.shopifyOrderId })
    .from(orders)
    .where(eq(orders.id, f.orderId))
    .limit(1);
  if (!order) return { ok: false, error: 'Order bulunamadı' };

  // Bu fulfillment'a bağlı line items'ı çek
  const myLineItems = await db
    .select({
      shopifyLineItemId: orderLineItems.shopifyLineItemId,
      quantity: fulfillmentLineItems.quantity,
    })
    .from(fulfillmentLineItems)
    .innerJoin(
      orderLineItems,
      eq(orderLineItems.id, fulfillmentLineItems.lineItemId),
    )
    .where(eq(fulfillmentLineItems.fulfillmentId, fulfillmentId));
  if (myLineItems.length === 0) return { ok: false, error: 'Line items eksik' };

  const shopifyOrderGid = order.shopifyOrderId.startsWith('gid://')
    ? order.shopifyOrderId
    : `gid://shopify/Order/${order.shopifyOrderId}`;

  const foRes = await shopifyGraphQL<FOQueryResp>(FO_QUERY, { id: shopifyOrderGid });
  const fos = foRes.order?.fulfillmentOrders.edges ?? [];
  if (fos.length === 0) {
    return { ok: false, error: 'Shopify order için fulfillmentOrder yok' };
  }

  // Her fulfillmentOrder için bizim line item'larımızdan eşleşeni topla.
  const lineItemsByFO: Array<{
    fulfillmentOrderId: string;
    fulfillmentOrderLineItems: Array<{ id: string; quantity: number }>;
  }> = [];

  const targetLineIds = new Set(
    myLineItems.map((m) =>
      m.shopifyLineItemId.startsWith('gid://')
        ? m.shopifyLineItemId
        : `gid://shopify/LineItem/${m.shopifyLineItemId}`,
    ),
  );

  const remainingByLI = new Map(
    myLineItems.map((m) => {
      const gid = m.shopifyLineItemId.startsWith('gid://')
        ? m.shopifyLineItemId
        : `gid://shopify/LineItem/${m.shopifyLineItemId}`;
      return [gid, m.quantity];
    }),
  );

  for (const foEdge of fos) {
    if (foEdge.node.status !== 'OPEN' && foEdge.node.status !== 'IN_PROGRESS') continue;
    const items: Array<{ id: string; quantity: number }> = [];
    for (const liEdge of foEdge.node.lineItems.edges) {
      const liGid = liEdge.node.lineItem.id;
      if (!targetLineIds.has(liGid)) continue;
      const need = remainingByLI.get(liGid) ?? 0;
      if (need <= 0) continue;
      const qty = Math.min(need, liEdge.node.remainingQuantity);
      if (qty <= 0) continue;
      items.push({ id: liEdge.node.id, quantity: qty });
      remainingByLI.set(liGid, need - qty);
    }
    if (items.length > 0) {
      lineItemsByFO.push({
        fulfillmentOrderId: foEdge.node.id,
        fulfillmentOrderLineItems: items,
      });
    }
  }

  if (lineItemsByFO.length === 0) {
    return { ok: false, error: 'Eşleşen fulfillmentOrder line item yok' };
  }

  const company = COMPANY_FROM_CARRIER[f.carrier ?? ''] ?? f.carrier ?? 'Other';

  const fcRes = await shopifyGraphQL<FCResp>(FC_MUTATION, {
    fulfillment: {
      notifyCustomer: true,
      trackingInfo: {
        number: f.trackingNumber ?? '',
        url: f.trackingUrl ?? undefined,
        company,
      },
      lineItemsByFulfillmentOrder: lineItemsByFO,
    },
  });

  if (fcRes.fulfillmentCreate.userErrors.length > 0) {
    return {
      ok: false,
      error: fcRes.fulfillmentCreate.userErrors.map((e) => e.message).join('; '),
    };
  }
  const sf = fcRes.fulfillmentCreate.fulfillment;
  if (!sf) return { ok: false, error: 'fulfillmentCreate boş döndü' };

  await db
    .update(fulfillments)
    .set({
      shopifyFulfillmentId: sf.id,
      updatedAt: new Date(),
    })
    .where(eq(fulfillments.id, f.id));

  return { ok: true, shopifyFulfillmentId: sf.id };
}
