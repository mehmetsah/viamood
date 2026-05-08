import crypto from 'node:crypto';
import { env } from '../env';

/**
 * Shopify webhook HMAC verification.
 * Header: x-shopify-hmac-sha256 base64.
 * Body MUST be raw request body (read before any parsing).
 */
export function verifyShopifyWebhook(rawBody: string | Buffer, hmacHeader: string): boolean {
  if (!env.SHOPIFY_WEBHOOK_SECRET) {
    console.warn('[shopify webhook] SHOPIFY_WEBHOOK_SECRET not set — verification skipped');
    return false;
  }

  const computed = crypto
    .createHmac('sha256', env.SHOPIFY_WEBHOOK_SECRET)
    .update(typeof rawBody === 'string' ? rawBody : rawBody)
    .digest('base64');

  // timing-safe compare
  const a = Buffer.from(computed);
  const b = Buffer.from(hmacHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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
