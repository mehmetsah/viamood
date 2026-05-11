/**
 * POST /api/v1/vendor/products  — toplu ürün upsert
 *
 * Body:
 * {
 *   "products": [
 *     {
 *       "sku": "VEN-001",
 *       "title": "Ürün",
 *       "price": 99.99,
 *       "compareAtPrice": 129.99,
 *       "cost": 50,
 *       "stock": 25,
 *       "barcode": "...",
 *       "description": "<p>HTML</p>",
 *       "productType": "Gıda",
 *       "weightGrams": 500,
 *       "imageUrl": "https://...",
 *       "status": "active",
 *       "tags": ["tag1", "tag2"]
 *     }
 *   ]
 * }
 *
 * Tek seferde max 500 ürün. Vendor token'ı gerekli (scope: products:write).
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { inventoryLevels, productVariants, products, vendors } from '@/db/schema';
import {
  hasScope,
  touchTokenUsage,
  verifyApiToken,
} from '@/lib/server/api-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const productSchema = z.object({
  sku: z.string().min(1).max(120),
  title: z.string().min(2).max(255),
  description: z.string().max(10000).optional(),
  productType: z.string().max(120).optional(),
  tags: z.array(z.string().max(60)).max(20).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  barcode: z.string().max(60).optional(),
  price: z.number().min(0).max(10_000_000),
  compareAtPrice: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  weightGrams: z.number().int().min(0).optional(),
  imageUrl: z.string().url().optional(),
});
const bodySchema = z.object({
  products: z.array(productSchema).min(1).max(500),
});

function toCents(n: number | undefined): bigint | null {
  if (n == null) return null;
  return BigInt(Math.round(n * 100));
}

function slugify(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i').replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u').replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export async function POST(req: NextRequest) {
  const ctx = await verifyApiToken(req.headers.get('authorization'));
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid or missing token' }, { status: 401 });
  }
  if (!hasScope(ctx, 'products:write')) {
    return NextResponse.json({ error: 'Token has no products:write scope' }, { status: 403 });
  }
  if (ctx.vendorStatus !== 'active') {
    return NextResponse.json({ error: `Vendor status: ${ctx.vendorStatus}` }, { status: 403 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

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

  const input = parsed.data.products;
  const skus = input.map((p) => p.sku);

  // Mevcut SKU'ları bul (upsert için)
  const existing = await db
    .select({
      productId: productVariants.productId,
      variantId: productVariants.id,
      sku: productVariants.sku,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.vendorId, ctx.vendorId),
        inArray(productVariants.sku, skus),
      ),
    );

  const bySku = new Map(existing.map((r) => [r.sku!, r]));

  let created = 0;
  let updated = 0;
  const errors: Array<{ sku: string; error: string }> = [];

  for (const p of input) {
    try {
      const priceCents = toCents(p.price)!;
      const compareCents = toCents(p.compareAtPrice);
      const costCents = toCents(p.cost);
      const exists = bySku.get(p.sku);

      await db.transaction(async (tx) => {
        if (exists) {
          // UPDATE
          await tx
            .update(products)
            .set({
              title: p.title,
              description: p.description ?? null,
              productType: p.productType ?? null,
              tags: p.tags ?? [],
              status: p.status ?? 'active',
              minPriceCents: priceCents,
              maxPriceCents: priceCents,
              featuredImageUrl: p.imageUrl ?? null,
              updatedAt: new Date(),
            })
            .where(eq(products.id, exists.productId));

          await tx
            .update(productVariants)
            .set({
              barcode: p.barcode ?? null,
              priceCents,
              compareAtPriceCents: compareCents,
              costCents,
              weightGrams: p.weightGrams ?? null,
              updatedAt: new Date(),
            })
            .where(eq(productVariants.id, exists.variantId));

          if (p.stock != null) {
            await tx
              .insert(inventoryLevels)
              .values({
                vendorId: ctx.vendorId,
                variantId: exists.variantId,
                quantity: p.stock,
                available: p.stock,
                reserved: 0,
              })
              .onConflictDoUpdate({
                target: [inventoryLevels.vendorId, inventoryLevels.variantId],
                set: { quantity: p.stock, available: p.stock, updatedAt: new Date() },
              });
          }
          updated++;
        } else {
          // INSERT
          const tempProductId = `local_${crypto.randomUUID()}`;
          const tempVariantId = `local_${crypto.randomUUID()}`;
          const handle = slugify(p.title) + '-' + Date.now().toString(36);

          const [product] = await tx
            .insert(products)
            .values({
              vendorId: ctx.vendorId,
              shopifyProductId: tempProductId,
              shopifyHandle: handle,
              title: p.title,
              description: p.description ?? null,
              productType: p.productType ?? null,
              tags: p.tags ?? [],
              status: p.status ?? 'active',
              vendorSlug: ctx.vendorSlug,
              vendorName: ctx.vendorName,
              minPriceCents: priceCents,
              maxPriceCents: priceCents,
              totalInventory: p.stock ?? 0,
              featuredImageUrl: p.imageUrl ?? null,
            })
            .returning({ id: products.id });
          if (!product) throw new Error('product insert fail');

          const [variant] = await tx
            .insert(productVariants)
            .values({
              productId: product.id,
              vendorId: ctx.vendorId,
              shopifyVariantId: tempVariantId,
              title: 'Default',
              sku: p.sku,
              barcode: p.barcode ?? null,
              priceCents,
              compareAtPriceCents: compareCents,
              costCents,
              weightGrams: p.weightGrams ?? null,
            })
            .returning({ id: productVariants.id });
          if (!variant) throw new Error('variant insert fail');

          if ((p.stock ?? 0) > 0) {
            await tx.insert(inventoryLevels).values({
              vendorId: ctx.vendorId,
              variantId: variant.id,
              quantity: p.stock ?? 0,
              available: p.stock ?? 0,
              reserved: 0,
            });
          }

          await tx
            .update(vendors)
            .set({ productCount: sql`${vendors.productCount} + 1` })
            .where(eq(vendors.id, ctx.vendorId));

          created++;
        }
      });
    } catch (err) {
      errors.push({
        sku: p.sku,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // Token usage tracking (fire-and-forget)
  touchTokenUsage(ctx.tokenId, ip ?? undefined).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    created,
    updated,
    errors,
    vendorId: ctx.vendorId,
  });
}
