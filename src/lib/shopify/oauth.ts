/**
 * Shopify OAuth helpers — install flow + callback.
 *
 * Akış:
 *   1. Admin "Bağla" butonu → /api/shopify/oauth/install
 *   2. Server CSRF nonce yarat → DB'ye yaz → user'ı Shopify auth URL'ine yönlendir
 *   3. User Shopify'da onaylar → callback (/api/shopify/oauth/callback?code=...&state=...)
 *   4. Server: HMAC verify, state lookup, code → access_token exchange
 *   5. Token'ı shopify_connections'a yaz → admin'e başarı mesajı
 */
import crypto from 'node:crypto';
import { env } from '../env';

const SHOPIFY_DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export function isValidShopDomain(domain: string): boolean {
  return SHOPIFY_DOMAIN_REGEX.test(domain);
}

export function buildAuthUrl(params: {
  shopDomain: string;
  state: string;
  redirectUri: string;
}): string {
  if (!env.SHOPIFY_CLIENT_ID) throw new Error('SHOPIFY_CLIENT_ID missing');

  const url = new URL(`https://${params.shopDomain}/admin/oauth/authorize`);
  url.searchParams.set('client_id', env.SHOPIFY_CLIENT_ID);
  url.searchParams.set('scope', env.SHOPIFY_SCOPES);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  // 'grant_options[]=per-user' eklenirse online token (kullanıcıya bağlı, kısa)
  // Default offline (mağazaya bağlı, kalıcı) — bizim ihtiyacımız bu.
  return url.toString();
}

export interface OauthCallbackParams {
  code: string;
  hmac: string;
  shop: string;
  state: string;
  timestamp: string;
}

export function verifyOauthHmac(query: URLSearchParams): boolean {
  if (!env.SHOPIFY_CLIENT_SECRET) return false;
  const hmacFromQuery = query.get('hmac');
  if (!hmacFromQuery) return false;

  // Build message: tüm query params (hmac hariç) alfabetik sırayla
  const params = Array.from(query.entries())
    .filter(([k]) => k !== 'hmac' && k !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const computed = crypto
    .createHmac('sha256', env.SHOPIFY_CLIENT_SECRET)
    .update(params)
    .digest('hex');

  // Timing-safe compare
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hmacFromQuery, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface AccessTokenResponse {
  access_token: string;
  scope: string;
}

export async function exchangeCodeForToken(
  shopDomain: string,
  code: string,
): Promise<AccessTokenResponse> {
  if (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) {
    throw new Error('Shopify client credentials missing');
  }

  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.SHOPIFY_CLIENT_ID,
      client_secret: env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify token exchange failed: ${res.status} ${body}`);
  }

  return (await res.json()) as AccessTokenResponse;
}

export async function fetchShopInfo(
  shopDomain: string,
  accessToken: string,
): Promise<{
  id?: string;
  name?: string;
  email?: string;
  countryCode?: string;
  currency?: string;
  primaryLocationId?: string;
}> {
  const res = await fetch(`https://${shopDomain}/admin/api/${env.SHOPIFY_API_VERSION}/shop.json`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return {};
  const data = (await res.json()) as {
    shop?: {
      id?: number;
      name?: string;
      email?: string;
      country_code?: string;
      currency?: string;
      primary_location_id?: number;
    };
  };
  const s = data.shop;
  if (!s) return {};
  return {
    id: s.id != null ? String(s.id) : undefined,
    name: s.name,
    email: s.email,
    countryCode: s.country_code,
    currency: s.currency,
    primaryLocationId: s.primary_location_id != null ? String(s.primary_location_id) : undefined,
  };
}
