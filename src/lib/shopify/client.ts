import { env } from '../env';

/**
 * Shopify Admin GraphQL/REST client (lightweight wrapper).
 * Daha sofistike hale gelirse @shopify/shopify-api SDK'ya geçeriz.
 */

const baseUrl = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}`;

interface AdminFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

class ShopifyAdminError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `Shopify Admin API error: ${status}`);
    this.name = 'ShopifyAdminError';
  }
}

async function adminFetch(path: string, options: AdminFetchOptions = {}): Promise<Response> {
  if (!env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    throw new Error('SHOPIFY_ADMIN_ACCESS_TOKEN is not set');
  }

  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_ACCESS_TOKEN,
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

export { ShopifyAdminError };
