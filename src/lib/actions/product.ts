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

interface ParsedVariant {
  id?: string;
  options: string[];
  priceCents: number;
  sku: string;
  stock: number;
}
interface ParsedVariants {
  variants: ParsedVariant[];
  options: { name: string; values: string[] }[];
}

/** Form'dan çoklu varyant verisini ayrıştırır. useVariants=1 değilse null (tekli yol). */
function parseVariants(formData: FormData): ParsedVariants | null {
  if (String(formData.get('useVariants') ?? '') !== '1') return null;
  let rawVariants: unknown;
  let rawOptions: unknown;
  try {
    rawVariants = JSON.parse(String(formData.get('variantsJson') ?? '[]'));
    rawOptions = JSON.parse(String(formData.get('optionsJson') ?? '[]'));
  } catch {
    return null;
  }
  if (!Array.isArray(rawVariants)) return null;
  const variants: ParsedVariant[] = rawVariants
    .filter((v): v is Record<string, unknown> => !!v && Array.isArray((v as Record<string, unknown>).options))
    .map((v) => ({
      id: typeof v.id === 'string' ? v.id : undefined,
      options: (v.options as unknown[]).map((o) => String(o)).slice(0, 3),
      priceCents: moneyToCents(String(v.price ?? '0')),
      sku: String(v.sku ?? '').trim(),
      stock: Math.max(0, Math.floor(Number(v.stock ?? 0)) || 0),
    }))
    .filter((v) => v.options.length > 0);
  if (!variants.length) return null;
  const options = Array.isArray(rawOptions)
    ? (rawOptions as { name: string; values: string[] }[]).filter((o) => o?.name && Array.isArray(o.values))
    : [];
  return { variants, options };
}

const localId = () => `local_${crypto.randomUUID()}`;

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

  // Çoklu varyant mı? (yoksa tekli "Default" varyant)
  const variantData = parseVariants(formData);
  const prices = variantData ? variantData.variants.map((v) => v.priceCents) : [data.priceCents];
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const totalStock = variantData
    ? variantData.variants.reduce((s, v) => s + v.stock, 0)
    : data.initialStock;

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
        shopifyProductId: localId(), // geçici; push sırasında gerçek Shopify ID alınır
        shopifyHandle: handle || `product-${Date.now()}`,
        title: data.title,
        description: data.description || null,
        productType: data.productType || null,
        tags: parseTags(data.tags || ''),
        status: data.status,
        vendorSlug: ctx.vendorSlug,
        vendorName: ctx.vendorName,
        minPriceCents: BigInt(minP),
        maxPriceCents: BigInt(maxP),
        totalInventory: totalStock,
        featuredImageUrl: data.featuredImageUrl || null,
        ...(variantData ? { metadata: { options: variantData.options } } : {}),
      })
      .returning({ id: products.id });

    if (!created) throw new Error('Ürün oluşturulamadı');
    productId = created.id;

    // Tekli ürünü de aynı döngüden geçir (tek "Default" varyant)
    const rows: ParsedVariant[] = variantData
      ? variantData.variants
      : [{ options: [], priceCents: data.priceCents, sku: data.sku ?? '', stock: data.initialStock }];

    for (const v of rows) {
      const [variant] = await tx
        .insert(productVariants)
        .values({
          productId: created.id,
          vendorId: ctx.vendorId,
          shopifyVariantId: localId(),
          title: v.options.length ? v.options.join(' / ') : 'Default',
          option1: v.options[0] ?? null,
          option2: v.options[1] ?? null,
          option3: v.options[2] ?? null,
          sku: v.sku || null,
          barcode: variantData ? null : data.barcode || null,
          priceCents: BigInt(v.priceCents),
          compareAtPriceCents:
            variantData ? null : data.compareAtPriceCents ? BigInt(data.compareAtPriceCents) : null,
          costCents: variantData ? null : data.costCents ? BigInt(data.costCents) : null,
          weightGrams: data.weightGrams,
        })
        .returning({ id: productVariants.id });

      if (!variant) throw new Error('Varyant oluşturulamadı');

      if (v.stock > 0) {
        await tx.insert(inventoryLevels).values({
          vendorId: ctx.vendorId,
          variantId: variant.id,
          quantity: v.stock,
          available: v.stock,
          reserved: 0,
        });
      }
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

  const variantData = parseVariants(formData);
  const prices = variantData ? variantData.variants.map((v) => v.priceCents) : [data.priceCents];
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        title: data.title,
        description: data.description || null,
        productType: data.productType || null,
        tags: parseTags(data.tags || ''),
        status: data.status,
        minPriceCents: BigInt(minP),
        maxPriceCents: BigInt(maxP),
        featuredImageUrl: data.featuredImageUrl || null,
        ...(variantData
          ? {
              metadata: { options: variantData.options },
              totalInventory: variantData.variants.reduce((s, v) => s + v.stock, 0),
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));

    if (variantData) {
      // Çoklu varyant: id'li → güncelle, id'siz → yeni ekle (+stok). Eksik olanlar silinmez (sipariş güvenliği).
      for (const v of variantData.variants) {
        if (v.id) {
          await tx
            .update(productVariants)
            .set({
              title: v.options.length ? v.options.join(' / ') : 'Default',
              option1: v.options[0] ?? null,
              option2: v.options[1] ?? null,
              option3: v.options[2] ?? null,
              sku: v.sku || null,
              priceCents: BigInt(v.priceCents),
              weightGrams: data.weightGrams,
              updatedAt: new Date(),
            })
            .where(and(eq(productVariants.id, v.id), eq(productVariants.productId, productId)));
        } else {
          const [nv] = await tx
            .insert(productVariants)
            .values({
              productId,
              vendorId: ctx.vendorId,
              shopifyVariantId: localId(),
              title: v.options.length ? v.options.join(' / ') : 'Default',
              option1: v.options[0] ?? null,
              option2: v.options[1] ?? null,
              option3: v.options[2] ?? null,
              sku: v.sku || null,
              priceCents: BigInt(v.priceCents),
              weightGrams: data.weightGrams,
            })
            .returning({ id: productVariants.id });
          if (nv && v.stock > 0) {
            await tx.insert(inventoryLevels).values({
              vendorId: ctx.vendorId,
              variantId: nv.id,
              quantity: v.stock,
              available: v.stock,
              reserved: 0,
            });
          }
        }
      }
    } else {
      // Tekli yol — mevcut "Default" varyantı güncelle
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
    }
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
