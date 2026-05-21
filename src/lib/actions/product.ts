'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db/client';
import { inventoryLevels, products, productVariants, vendors } from '@/db/schema';
import { auditUser } from '@/lib/audit/logger';
import { canEdit, requireActiveVendor, requireVendor } from '@/lib/server/vendor-context';
import { pushProductToShopify } from '@/lib/shopify/products';
import type { ActionResult } from './auth';

const productSchema = z.object({
  title: z.string().min(2, 'Başlık en az 2 karakter').max(255),
  description: z.string().max(8000).optional().or(z.literal('')),
  productType: z.string().max(120).optional().or(z.literal('')),
  tags: z.string().max(500).optional().or(z.literal('')),
  status: z.enum(['draft', 'active', 'archived']),
  // Single variant (multi-variant Phase 2.2'de)
  sku: z.string().max(120).optional().or(z.literal('')),
  barcode: z.string().max(60).optional().or(z.literal('')),
  priceCents: z.number().int().min(0).max(10_000_000_00), // max 10M TL
  compareAtPriceCents: z.number().int().min(0).optional().nullable(),
  costCents: z.number().int().min(0).optional().nullable(),
  weightGrams: z.number().int().min(0).optional().nullable(),
  initialStock: z.number().int().min(0).default(0),
  featuredImageUrl: z.string().url().optional().or(z.literal('')),
});

function moneyToCents(input: string | number): number {
  if (typeof input === 'number') return Math.round(input * 100);
  const cleaned = String(input).replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[,\n]/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 50);
}

export async function createProductAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireActiveVendor();
  if (!canEdit(ctx.role)) return { success: false, error: 'Yetkin yok' };

  const raw = {
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? ''),
    productType: String(formData.get('productType') ?? '').trim(),
    tags: String(formData.get('tags') ?? ''),
    status: String(formData.get('status') ?? 'draft') as 'draft' | 'active' | 'archived',
    sku: String(formData.get('sku') ?? '').trim(),
    barcode: String(formData.get('barcode') ?? '').trim(),
    priceCents: moneyToCents(String(formData.get('price') ?? '0')),
    compareAtPriceCents: formData.get('compareAtPrice')
      ? moneyToCents(String(formData.get('compareAtPrice')))
      : null,
    costCents: formData.get('cost') ? moneyToCents(String(formData.get('cost'))) : null,
    weightGrams: formData.get('weightGrams') ? Number(formData.get('weightGrams')) : null,
    initialStock: Number(formData.get('initialStock') ?? 0),
    featuredImageUrl: String(formData.get('featuredImageUrl') ?? '').trim(),
  };

  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message;
    }
    return { success: false, error: 'Lütfen formu kontrol et', fieldErrors };
  }
  const data = parsed.data;

  // Shopify ürün kimliği henüz yok — geçici unique ID. Phase 2.2 sync'inde gerçek ID alınır.
  const tempShopifyProductId = `local_${crypto.randomUUID()}`;
  const tempShopifyVariantId = `local_${crypto.randomUUID()}`;

  // Slug için handle (basitçe title'dan)
  const handle = data.title
    .toLowerCase()
    .replace(/[ı]/g, 'i').replace(/[ğ]/g, 'g').replace(/[ü]/g, 'u')
    .replace(/[ş]/g, 's').replace(/[ö]/g, 'o').replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

  let productId = '';

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(products)
      .values({
        vendorId: ctx.vendorId,
        shopifyProductId: tempShopifyProductId,
        shopifyHandle: handle || `product-${Date.now()}`,
        title: data.title,
        description: data.description || null,
        productType: data.productType || null,
        tags: parseTags(data.tags || ''),
        status: data.status,
        vendorSlug: ctx.vendorSlug,
        vendorName: ctx.vendorName,
        minPriceCents: BigInt(data.priceCents),
        maxPriceCents: BigInt(data.priceCents),
        totalInventory: data.initialStock,
        featuredImageUrl: data.featuredImageUrl || null,
      })
      .returning({ id: products.id });

    if (!created) throw new Error('Ürün oluşturulamadı');
    productId = created.id;

    const [variant] = await tx
      .insert(productVariants)
      .values({
        productId: created.id,
        vendorId: ctx.vendorId,
        shopifyVariantId: tempShopifyVariantId,
        title: 'Default',
        sku: data.sku || null,
        barcode: data.barcode || null,
        priceCents: BigInt(data.priceCents),
        compareAtPriceCents: data.compareAtPriceCents ? BigInt(data.compareAtPriceCents) : null,
        costCents: data.costCents ? BigInt(data.costCents) : null,
        weightGrams: data.weightGrams,
      })
      .returning({ id: productVariants.id });

    if (!variant) throw new Error('Varyant oluşturulamadı');

    if (data.initialStock > 0) {
      await tx.insert(inventoryLevels).values({
        vendorId: ctx.vendorId,
        variantId: variant.id,
        quantity: data.initialStock,
        available: data.initialStock,
        reserved: 0,
      });
    }

    // Vendor counter — atomic increment
    await tx
      .update(vendors)
      .set({ productCount: sql`${vendors.productCount} + 1` })
      .where(eq(vendors.id, ctx.vendorId));
  });

  revalidatePath('/products');
  redirect(`/products/${productId}`);
}

export async function updateProductAction(
  productId: string,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireActiveVendor();
  if (!canEdit(ctx.role)) return { success: false, error: 'Yetkin yok' };

  // Ürün gerçekten bu vendor'a mı ait?
  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.vendorId, ctx.vendorId)))
    .limit(1);
  if (!existing) return { success: false, error: 'Ürün bulunamadı' };

  const raw = {
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? ''),
    productType: String(formData.get('productType') ?? '').trim(),
    tags: String(formData.get('tags') ?? ''),
    status: String(formData.get('status') ?? 'draft') as 'draft' | 'active' | 'archived',
    sku: String(formData.get('sku') ?? '').trim(),
    barcode: String(formData.get('barcode') ?? '').trim(),
    priceCents: moneyToCents(String(formData.get('price') ?? '0')),
    compareAtPriceCents: formData.get('compareAtPrice')
      ? moneyToCents(String(formData.get('compareAtPrice')))
      : null,
    costCents: formData.get('cost') ? moneyToCents(String(formData.get('cost'))) : null,
    weightGrams: formData.get('weightGrams') ? Number(formData.get('weightGrams')) : null,
    initialStock: 0, // edit'te kullanılmıyor, ayrı stok ekranı
    featuredImageUrl: String(formData.get('featuredImageUrl') ?? '').trim(),
  };

  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message;
    }
    return { success: false, error: 'Lütfen formu kontrol et', fieldErrors };
  }
  const data = parsed.data;

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        title: data.title,
        description: data.description || null,
        productType: data.productType || null,
        tags: parseTags(data.tags || ''),
        status: data.status,
        minPriceCents: BigInt(data.priceCents),
        maxPriceCents: BigInt(data.priceCents),
        featuredImageUrl: data.featuredImageUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));

    // Default variant'ı güncelle
    await tx
      .update(productVariants)
      .set({
        sku: data.sku || null,
        barcode: data.barcode || null,
        priceCents: BigInt(data.priceCents),
        compareAtPriceCents: data.compareAtPriceCents ? BigInt(data.compareAtPriceCents) : null,
        costCents: data.costCents ? BigInt(data.costCents) : null,
        weightGrams: data.weightGrams,
        updatedAt: new Date(),
      })
      .where(eq(productVariants.productId, productId));
  });

  revalidatePath('/products');
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function pushProductToShopifyAction(
  productId: string,
): Promise<ActionResult> {
  const ctx = await requireActiveVendor();
  if (!canEdit(ctx.role)) return { success: false, error: 'Yetkin yok' };

  const [existing] = await db
    .select({ id: products.id, shopifyProductId: products.shopifyProductId })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.vendorId, ctx.vendorId)))
    .limit(1);
  if (!existing) return { success: false, error: 'Ürün bulunamadı' };

  const result = await pushProductToShopify(productId);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  await auditUser(
    ctx.userId,
    'shopify.product.push',
    'product',
    productId,
    {
      after: {
        shopifyProductId: result.shopifyProductId,
        shopifyVariantId: result.shopifyVariantId,
      },
    },
  );

  revalidatePath('/products');
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

/** Ersin'in fiyat hesap modülü — variant.pricing_config güncelleme */
const pricingConfigSchema = z.object({
  purchasePriceExclVat: z.coerce.number().min(0).optional(),
  purchasePriceInclVat: z.coerce.number().min(0).optional(),
  vatPct: z.coerce.number().min(0).max(100).optional(),
  desi: z.coerce.number().min(0).optional(),
  packagingCost: z.coerce.number().min(0).optional(),
  advertisingCost: z.coerce.number().min(0).optional(),
  targetProfitPct: z.coerce.number().min(0).max(500).optional(),
  trendyolPrice: z.coerce.number().min(0).optional(),
  trendyolCommissionBase: z.coerce.number().min(0).optional(),
  trendyolCommissionPct: z.coerce.number().min(0).max(100).optional(),
  paymentServicePct: z.coerce.number().min(0).max(100).optional(),
  trendyolKargoOverride: z.coerce.number().min(0).optional(),
  instagramPrice: z.coerce.number().min(0).optional(),
  pttKargoOverride: z.coerce.number().min(0).optional(),
});

export async function updateVariantPricingAction(
  variantId: string,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireVendor();
  if (!canEdit(ctx.role)) {
    return { success: false, error: 'Yetkin yok' };
  }

  // Vendor scope kontrol — vendor sadece kendi variantını düzenleyebilir
  const [variant] = await db
    .select({ id: productVariants.id, vendorId: productVariants.vendorId, productId: productVariants.productId })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);
  if (!variant) return { success: false, error: 'Variant bulunamadı' };
  if (variant.vendorId !== ctx.vendorId) {
    return { success: false, error: 'Bu varianta erişimin yok' };
  }

  // Form'u parse et — boş alanlar undefined olur
  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === 'string' && v.trim() !== '') raw[k] = v;
  }

  const parsed = pricingConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Form hatası' };
  }

  // Sadece dolu (defined) alanları sakla
  const cleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v != null) cleaned[k] = v;
  }

  await db
    .update(productVariants)
    .set({ pricingConfig: cleaned, updatedAt: new Date() })
    .where(eq(productVariants.id, variantId));

  await auditUser(ctx.userId, 'variant.pricing.update', 'variant', variantId, {
    after: cleaned,
  });

  revalidatePath(`/products/${variant.productId}`);
  revalidatePath(`/admin/products`);
  return { success: true };
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const ctx = await requireVendor();
  if (!canEdit(ctx.role)) throw new Error('Yetkin yok');

  const productId = z.string().uuid().parse(formData.get('productId'));

  await db.transaction(async (tx) => {
    const result = await tx
      .update(products)
      .set({ deletedAt: new Date(), status: 'archived' })
      .where(
        and(eq(products.id, productId), eq(products.vendorId, ctx.vendorId)),
      )
      .returning({ id: products.id });

    if (result.length > 0) {
      await tx
        .update(vendors)
        .set({ productCount: sql`GREATEST(0, ${vendors.productCount} - 1)` })
        .where(eq(vendors.id, ctx.vendorId));
    }
  });

  revalidatePath('/products');
}
