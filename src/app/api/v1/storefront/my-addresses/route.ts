/**
 * Storefront adres köprüsü v2 — PORTAL OTURUMU ile (HMAC email köprüsünün üstünde).
 *
 * Sorun: HMAC köprüsü Shopify storefront oturumunun e-postasını sorgular; müşteri
 * portala FARKLI e-postayla üye olduysa yanlış/boş liste gelir. Bu uç, isteği
 * atan tarayıcıdaki PORTAL (NextAuth) oturumunu okur → her zaman doğru hesap.
 *
 * hesap.viamood.com.tr ↔ viamood.com.tr aynı site (eTLD+1) olduğundan SameSite=Lax
 * çerez credentials:'include' fetch'iyle gider. NOT: checkout HTTPS olduğundan bu
 * uç ancak hesap subdomain'i SSL aldıktan sonra çalışır (mixed content); o zamana
 * dek tema HMAC köprüsüne düşer.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { customerAddresses } from '@/db/schema';
import { getSessionCustomer } from '@/lib/customers/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ORIGINS = new Set([
  'https://viamood.com.tr',
  'https://www.viamood.com.tr',
]);

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://viamood.com.tr',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const customer = await getSessionCustomer();
  if (!customer) {
    return NextResponse.json({ ok: false, error: 'oturum yok' }, { status: 401, headers: corsHeaders(req) });
  }

  const rows = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customer.id))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt))
    .limit(20);

  return NextResponse.json(
    {
      ok: true,
      adresler: rows.map((r) => ({
        label: r.label,
        firstName: r.firstName,
        lastName: r.lastName,
        phone: r.phone,
        province: r.province,
        district: r.district,
        neighborhood: r.neighborhood,
        address1: r.address1,
        postalCode: r.postalCode,
        isDefault: r.isDefault,
      })),
    },
    { headers: corsHeaders(req) },
  );
}
