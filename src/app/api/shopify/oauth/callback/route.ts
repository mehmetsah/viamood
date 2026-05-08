import { and, eq, gt } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db/client';
import { shopifyConnections, shopifyOauthStates } from '@/db/schema';
import { auditUser } from '@/lib/audit/logger';
import {
  exchangeCodeForToken,
  fetchShopInfo,
  isValidShopDomain,
  verifyOauthHmac,
} from '@/lib/shopify/oauth';

export const dynamic = 'force-dynamic';

function errorRedirect(message: string): NextResponse {
  const url = new URL('/admin/shopify', process.env.APP_URL ?? 'http://localhost:3000');
  url.searchParams.set('error', message);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get('code');
  const shop = params.get('shop');
  const state = params.get('state');

  if (!code || !shop || !state) {
    return errorRedirect('Eksik parametre (code/shop/state)');
  }

  if (!isValidShopDomain(shop)) {
    return errorRedirect('Geçersiz shop domain');
  }

  // 1. HMAC doğrula
  if (!verifyOauthHmac(params)) {
    return errorRedirect('HMAC doğrulaması başarısız');
  }

  // 2. State (nonce) DB'de var mı + süresi geçmemiş mi
  const [stateRow] = await db
    .select()
    .from(shopifyOauthStates)
    .where(and(eq(shopifyOauthStates.state, state), gt(shopifyOauthStates.expiresAt, new Date())))
    .limit(1);

  if (!stateRow) {
    return errorRedirect('Geçersiz veya süresi dolmuş state');
  }
  if (stateRow.shopDomain !== shop) {
    return errorRedirect('Shop domain uyuşmuyor');
  }

  // 3. State'i tüket (one-time use)
  await db.delete(shopifyOauthStates).where(eq(shopifyOauthStates.state, state));

  // 4. Code → access_token
  let tokenData: { access_token: string; scope: string };
  try {
    tokenData = await exchangeCodeForToken(shop, code);
  } catch (err) {
    return errorRedirect(
      'Token exchange başarısız: ' + (err instanceof Error ? err.message : 'unknown'),
    );
  }

  // 5. Shop info çek (best-effort)
  const shopInfo: Awaited<ReturnType<typeof fetchShopInfo>> = await fetchShopInfo(
    shop,
    tokenData.access_token,
  ).catch(() => ({} as Awaited<ReturnType<typeof fetchShopInfo>>));

  // 6. DB'ye yaz (upsert)
  await db
    .insert(shopifyConnections)
    .values({
      shopDomain: shop,
      accessToken: tokenData.access_token,
      scope: tokenData.scope,
      shopId: shopInfo.id ?? null,
      shopName: shopInfo.name ?? null,
      shopEmail: shopInfo.email ?? null,
      countryCode: shopInfo.countryCode ?? null,
      currency: shopInfo.currency ?? null,
      primaryLocationId: shopInfo.primaryLocationId ?? null,
      installedAt: new Date(),
      uninstalledAt: null,
    })
    .onConflictDoUpdate({
      target: shopifyConnections.shopDomain,
      set: {
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
        shopId: shopInfo.id ?? null,
        shopName: shopInfo.name ?? null,
        shopEmail: shopInfo.email ?? null,
        countryCode: shopInfo.countryCode ?? null,
        currency: shopInfo.currency ?? null,
        primaryLocationId: shopInfo.primaryLocationId ?? null,
        installedAt: new Date(),
        uninstalledAt: null,
        updatedAt: new Date(),
      },
    });

  if (stateRow.initiatedByUserId) {
    await auditUser(stateRow.initiatedByUserId, 'shopify.oauth.install', 'shopify_connection', shop, {
      after: { scope: tokenData.scope },
    });
  }

  // 7. Başarı redirect
  const successUrl = new URL('/admin/shopify', process.env.APP_URL ?? 'http://localhost:3000');
  successUrl.searchParams.set('connected', '1');
  successUrl.searchParams.set('shop', shop);
  return NextResponse.redirect(successUrl);
}
