/**
 * POST /api/v1/vendor/inventory  — toplu stok güncelleme
 *
 * Body:
 * {
 *   "items": [
 *     { "sku": "VEN-001", "quantity": 25 },
 *     { "sku": "VEN-002", "quantity": 0 }
 *   ]
 * }
 *
 * Vendor token + scope: inventory:write
 */
import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { inventoryLevels, productVariants } from '@/db/schema';
import { hasScope, touchTokenUsage, verifyApiToken } from '@/lib/server/api-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().min(1).max(120),
        quantity: z.number().int().min(0).max(1_000_000),
      }),
    )
    .min(1)
    .max(2000),
});

export async function POST(req: NextRequest) {
  const ctx = await verifyApiToken(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Invalid or missing token' }, { status: 401 });
  if (!hasScope(ctx, 'inventory:write')) {
    return NextResponse.json({ error: 'Token has no inventory:write scope' }, { status: 403 });
  }
  if (ctx.vendorStatus !== 'active') {
    return NextResponse.json({ error: `Vendor status: ${ctx.vendorStatus}` }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 422 },
    );
  }

  const items = parsed.data.items;
  const skus = items.map((i) => i.sku);

  const variants = await db
    .select({ id: productVariants.id, sku: productVariants.sku })
    .from(productVariants)
    .where(and(eq(productVariants.vendorId, ctx.vendorId), inArray(productVariants.sku, skus)));

  const bySku = new Map(variants.map((v) => [v.sku!, v.id]));

  let updated = 0;
  const errors: Array<{ sku: string; error: string }> = [];

  for (const item of items) {
    const variantId = bySku.get(item.sku);
    if (!variantId) {
      errors.push({ sku: item.sku, error: 'SKU not found in vendor catalog' });
      continue;
    }
    try {
      await db
        .insert(inventoryLevels)
        .values({
          vendorId: ctx.vendorId,
          variantId,
          quantity: item.quantity,
          available: item.quantity,
          reserved: 0,
        })
        .onConflictDoUpdate({
          target: [inventoryLevels.vendorId, inventoryLevels.variantId],
          set: { quantity: item.quantity, available: item.quantity, updatedAt: new Date() },
        });
      updated++;
    } catch (err) {
      errors.push({
        sku: item.sku,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  touchTokenUsage(ctx.tokenId, ip).catch(() => undefined);

  return NextResponse.json({ ok: true, updated, errors });
}
