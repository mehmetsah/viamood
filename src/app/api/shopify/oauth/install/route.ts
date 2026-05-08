import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db/client';
import { shopifyOauthStates } from '@/db/schema';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { buildAuthUrl, isValidShopDomain } from '@/lib/shopify/oauth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Admin kontrolü
  const session = await auth();
  const role = session?.user?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Admin yetkisi gerekli' }, { status: 403 });
  }

  const shopDomain =
    req.nextUrl.searchParams.get('shop') || env.SHOPIFY_STORE_DOMAIN;

  if (!isValidShopDomain(shopDomain)) {
    return NextResponse.json({ error: 'Geçersiz shop domain' }, { status: 400 });
  }

  if (!env.SHOPIFY_CLIENT_ID) {
    return NextResponse.json(
      { error: 'SHOPIFY_CLIENT_ID env\'de set edilmemiş' },
      { status: 500 },
    );
  }

  // CSRF nonce
  const state = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 dakika

  await db.insert(shopifyOauthStates).values({
    state,
    shopDomain,
    initiatedByUserId: session?.user?.id ?? null,
    expiresAt,
  });

  // Redirect URI — Partners app config'inde tanımlı olmalı
  const redirectUri = `${env.APP_URL}/api/shopify/oauth/callback`;

  const authUrl = buildAuthUrl({ shopDomain, state, redirectUri });
  return NextResponse.redirect(authUrl);
}
