import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db/client';
import { vendors } from '@/db/schema';
import { createSubmerchant } from '@/lib/iyzico/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 });
  }
  const { vendorId } = (await req.json()) as { vendorId?: string };
  if (!vendorId) return NextResponse.json({ error: 'vendorId gerekli' }, { status: 400 });

  const [v] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!v) return NextResponse.json({ error: 'vendor yok' }, { status: 404 });
  if (!v.iban) return NextResponse.json({ error: 'IBAN yok' }, { status: 400 });
  if (v.iyzicoSubmerchantKey) {
    return NextResponse.json({ ok: true, subMerchantKey: v.iyzicoSubmerchantKey, alreadyExists: true });
  }

  const isCorporate = !!v.taxOffice && !!v.taxId && v.taxId.length === 10;
  try {
    const result = await createSubmerchant({
      vendorId: v.id,
      legalName: v.legalName ?? v.name,
      taxId: v.taxId ?? '',
      iban: v.iban,
      contactName: v.name,
      email: v.email,
      gsmNumber: v.phone ?? undefined,
      addressLine: [v.addressLine1, v.district, v.city].filter(Boolean).join(', '),
      city: v.city ?? undefined,
      country: v.country ?? 'TR',
      zipCode: v.postalCode ?? undefined,
      taxOffice: v.taxOffice ?? undefined,
      identityNumber: !isCorporate && v.taxId?.length === 11 ? v.taxId : undefined,
      subMerchantType: isCorporate ? 'LIMITED_OR_JOINT_STOCK_COMPANY' : 'PERSONAL',
    });

    await db
      .update(vendors)
      .set({ iyzicoSubmerchantKey: result.subMerchantKey, updatedAt: new Date() })
      .where(eq(vendors.id, vendorId));
    return NextResponse.json({ ok: true, subMerchantKey: result.subMerchantKey });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
