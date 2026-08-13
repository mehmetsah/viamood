/**
 * Storefront adres köprüsü — tema checkout'u (viamood.com.tr/pages/odeme)
 * "Kayıtlı adreslerim" dropdown'ını müşteri portalındaki (RDS) adreslerle doldurur.
 *
 * Auth: Shopify Liquid `hmac_sha256` filtresi — tema, oturumdaki müşterinin
 * e-postasını {{ customer.email | hmac_sha256: BRIDGE_KEY }} imzasıyla gömer;
 * burada aynı anahtarla doğrulanır. Sunucuya env eklenemediği için anahtar kod
 * sabiti (private repo + tema kaynağı aynı güven alanı — store staff zaten
 * müşteri verisine erişebilir).
 *
 * Query: ?email=<customer.email>&sig=<hex hmac_sha256(email, BRIDGE_KEY)>
 * Response: { ok:true, adresler:[{label,firstName,lastName,phone,province,
 *             district,neighborhood,address1,postalCode,isDefault}] }
 */
import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { env } from '@/lib/env';
import { customerAddresses, customers } from '@/db/schema';
import { dedupeAddressRows } from '@/lib/customers/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// via-checkout.liquid ile paylaşılan köprü anahtarı — DEĞİŞİRSE temayı da güncelle.
// Tenant başına FARKLI olmalı (multi-instance): env varsa onu kullan; yoksa mevcut Via Mood sabiti (geriye uyumlu).
const BRIDGE_KEY = process.env.STOREFRONT_BRIDGE_KEY ?? '15e66ee567ae0186394a79588f077a84ba483c8f341508f237bd5f7500524734';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': env.STOREFRONT_URL.replace(/\/$/, ''),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get('email') ?? '').trim();
  const sig = (req.nextUrl.searchParams.get('sig') ?? '').trim().toLowerCase();

  if (!email || !sig) {
    return NextResponse.json(
      { ok: false, error: 'email + sig zorunlu' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // İmza doğrulama (sabit-zaman karşılaştırma; geçersiz hex → reddet)
  const expected = crypto.createHmac('sha256', BRIDGE_KEY).update(email).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, 'hex');
  } catch {
    given = Buffer.alloc(0);
  }
  if (given.length !== expected.length || !crypto.timingSafeEqual(expected, given)) {
    return NextResponse.json(
      { ok: false, error: 'imza geçersiz' },
      { status: 403, headers: corsHeaders() },
    );
  }

  const [cust] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(sql`lower(${customers.email}) = ${email.toLowerCase()}`)
    .limit(1);

  if (!cust) {
    return NextResponse.json({ ok: true, adresler: [] }, { headers: corsHeaders() });
  }

  const rows = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, cust.id))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt))
    .limit(20);

  return NextResponse.json(
    {
      ok: true,
      adresler: dedupeAddressRows(rows).map((r) => ({
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
    { headers: corsHeaders() },
  );
}
