import crypto from 'node:crypto';
import { env } from '../env';

/**
 * Shopify webhook HMAC verification.
 * Header: x-shopify-hmac-sha256 base64.
 * Body MUST be raw request body (read before any parsing).
 *
 * OAuth (Partners) app'lerde signing secret = SHOPIFY_CLIENT_SECRET.
 * Custom legacy webhook'lar için ayrı SHOPIFY_WEBHOOK_SECRET kullanılır.
 * Önce client secret denenir, varsa ek webhook secret de kontrol edilir.
 */
export function verifyShopifyWebhook(rawBody: string | Buffer, hmacHeader: string): boolean {
  const candidates: string[] = [];
  if (env.SHOPIFY_CLIENT_SECRET) candidates.push(env.SHOPIFY_CLIENT_SECRET);
  if (env.SHOPIFY_WEBHOOK_SECRET) candidates.push(env.SHOPIFY_WEBHOOK_SECRET);

  if (candidates.length === 0) {
    console.warn(
      '[shopify webhook] SHOPIFY_CLIENT_SECRET / SHOPIFY_WEBHOOK_SECRET set değil — verify skip',
    );
    return false;
  }

  const bodyBuf = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const headerBuf = Buffer.from(hmacHeader);

  for (const secret of candidates) {
    const computed = crypto.createHmac('sha256', secret).update(bodyBuf).digest('base64');
    const compBuf = Buffer.from(computed);
    if (compBuf.length === headerBuf.length && crypto.timingSafeEqual(compBuf, headerBuf)) {
      return true;
    }
  }
  return false;
}

/**
 * Shopify webhook topic'leri — subscribe edilenler.
 * @see https://shopify.dev/api/admin-rest/2025-01/resources/webhook
 */
export const ShopifyWebhookTopic = {
  OrdersCreate: 'orders/create',
  OrdersPaid: 'orders/paid',
  OrdersCancelled: 'orders/cancelled',
  OrdersUpdated: 'orders/updated',
  OrdersFulfilled: 'orders/fulfilled',
  RefundsCreate: 'refunds/create',
  ProductsCreate: 'products/create',
  ProductsUpdate: 'products/update',
  ProductsDelete: 'products/delete',
  InventoryLevelsUpdate: 'inventory_levels/update',
} as const;

export type ShopifyWebhookTopic =
  (typeof ShopifyWebhookTopic)[keyof typeof ShopifyWebhookTopic];
