import { eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { shopifyConnections } from '@/db/schema';
import { env } from '../env';

/**
 * Shopify Admin API client.
 * Token DB'den (shopify_connections) çekilir; yoksa SHOPIFY_ADMIN_ACCESS_TOKEN env'ine fallback.
 */

interface CachedConnection {
  domain: string;
  token: string;
  primaryLocationId: string | null;
  loadedAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 1 dakika
let cached: CachedConnection | null = null;

async function loadConnection(): Promise<CachedConnection> {
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached;

  const [conn] = await db
    .select({
      domain: shopifyConnections.shopDomain,
      token: shopifyConnections.accessToken,
      primaryLocationId: shopifyConnections.primaryLocationId,
    })
    .from(shopifyConnections)
    .where(isNull(shopifyConnections.uninstalledAt))
    .limit(1);

  if (conn) {
    cached = {
      domain: conn.domain,
      token: conn.token,
      primaryLocationId: conn.primaryLocationId,
      loadedAt: Date.now(),
    };
    return cached;
  }

  // Fallback to env (custom app token)
  if (env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    cached = {
      domain: env.SHOPIFY_STORE_DOMAIN,
      token: env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      primaryLocationId: null,
      loadedAt: Date.now(),
    };
    return cached;
  }

  throw new Error('Shopify bağlantısı yok — admin/shopify üstünden bağla');
}

export function invalidateShopifyCache() {
  cached = null;
}

interface AdminFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

export class ShopifyAdminError extends Error {
  constructor(public status: number, public body: unknown, message?: string) {
    super(message ?? `Shopify Admin API error: ${status}`);
    this.name = 'ShopifyAdminError';
  }
}

async function adminFetch(path: string, options: AdminFetchOptions = {}): Promise<Response> {
  const { domain, token } = await loadConnection();
  const url = path.startsWith('http')
    ? path
    : `https://${domain}/admin/api/${env.SHOPIFY_API_VERSION}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new ShopifyAdminError(res.status, body);
  }

  return res;
}

export async function shopifyGraphQL<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await adminFetch('/graphql.json', {
    method: 'POST',
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) {
    throw new ShopifyAdminError(200, json.errors, 'GraphQL errors');
  }
  return json.data as T;
}

export async function shopifyRest<T = unknown>(
  path: string,
  options: AdminFetchOptions = {},
): Promise<T> {
  const res = await adminFetch(path, options);
  return (await res.json()) as T;
}

export async function shopifyConnected(): Promise<boolean> {
  try {
    await loadConnection();
    return true;
  } catch {
    return false;
  }
}
