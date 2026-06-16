'use server';

/**
 * Admin ürün yönetimi — admin/super_admin, TEDARİKÇİ SEÇEREK ürün gir/düzenle/sil/yayınla.
 * Vendor-scope product.ts'in admin karşılığı: requireActiveVendor yerine requireAdmin,
 * vendorId session'dan değil FORM'dan (admin hangi tedarikçi adına işlem yapıyorsa).
 */
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db/client';
import { inventoryLevels, products, productVariants, vendors } from '@/db/schema';
import { auditUser } from '@/lib/audit/logger';
import { auth } from '@/lib/auth';
import { pushProductToShopify } from '@/lib/shopify/products';
import type { ActionResult } from './auth';

async function requireAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'admin' && role !== 'super_admin')) {
    throw new Error('Unauthorized: admin yetkisi gerekli');
  }
  return session.user;
}

const productSchema = z.object({
  title: z.string().min(2, 'Başlık en az 2 karakter').max(255),
  description: z.string().max(8000).optional().or(z.literal('')),
  productType: z.string().max(120).optional().or(z.literal('')),
  tags: z.string().max(500).optional().or(z.literal('')),
  status: z.enum(['draft', 'active', 'archived']),
  sku: z.string().max(120).optional().or(z.literal('')),
  barcode: z.string().max(60).optional().or(z.literal('')),
  priceCents: z.number().int().min(0).max(10_000_000_00),
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

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[ı]/g, 'i').replace(/[ğ]/g, 'g').replace(/[ü]/g, 'u')
    .replace(/[ş]/g, 's').replace(/[ö]/g, 'o').replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/** Galeri hidden input'undaki JSON görsel dizisini güvenli parse et (http(s) URL'ler). */
function parseImages(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u))
      .slice(0, 30);
  } catch {
    return [];
  }
}

function readProductForm(formData: FormData) {
  return {
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
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join('.')] = issue.message;
  return fieldErrors;
}

/** Admin: seçilen tedarikçi adına yeni ürün oluştur. */
export async function adminCreateProductAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const vendorId = String(formData.get('vendorId') ?? '').trim();
  if (!vendorId) {
    return { success: false, error: 'Tedarikçi seçilmedi', fieldErrors: { vendorId: 'Tedarikçi zorunlu' } };
  }
  const [vendor] = await db
    .select({ id: vendors.id, slug: vendors.slug, name: vendors.name })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);
  if (!vendor) return { success: false, error: 'Tedarikçi bulunamadı' };

  const parsed = productSchema.safeParse(readProductForm(formData));
  if (!parsed.success) {
    return { success: false, error: 'Lütfen formu kontrol et', fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const data = parsed.data;
  const imagesArr = parseImages(formData.get('images'));

  const tempShopifyProductId = `local_${crypto.randomUUID()}`;
  const tempShopifyVariantId = `local_${crypto.randomUUID()}`;
  const handle = slugify(data.title);

  let productId = '';
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(products)
      .values({
        vendorId: vendor.id,
        shopifyProductId: tempShopifyProductId,
        shopifyHandle: handle || `product-${Date.now()}`,
        title: data.title,
        description: data.description || null,
        productType: data.productType || null,
        tags: parseTags(data.tags || ''),
        status: data.status,
        vendorSlug: vendor.slug,
        vendorName: vendor.name,
        minPriceCents: BigInt(data.priceCents),
        maxPriceCents: BigInt(data.priceCents),
        totalInventory: data.initialStock,
        featuredImageUrl: (imagesArr[0] || data.featuredImageUrl) || null,
        metadata: imagesArr.length ? { images: imagesArr } : {},
      })
      .returning({ id: products.id });
    if (!created) throw new Error('Ürün oluşturulamadı');
    productId = created.id;

    const [variant] = await tx
      .insert(productVariants)
      .values({
        productId: created.id,
        vendorId: vendor.id,
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
        vendorId: vendor.id,
        variantId: variant.id,
        quantity: data.initialStock,
        available: data.initialStock,
        reserved: 0,
      });
    }

    await tx
      .update(vendors)
      .set({ productCount: sql`${vendors.productCount} + 1` })
      .where(eq(vendors.id, vendor.id));
  });

  await auditUser(admin.id!, 'admin.product.create', 'product', productId, {
    after: { vendorId: vendor.id, vendorName: vendor.name, title: data.title, status: data.status },
  });

  revalidatePath('/admin/products');
  redirect(`/admin/products/${productId}`);
}

/** Admin: herhangi bir ürünü düzenle (vendor-scope kontrolü yok). */
export async function adminUpdateProductAction(
  productId: string,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!existing) return { success: false, error: 'Ürün bulunamadı' };

  const parsed = productSchema.safeParse(readProductForm(formData));
  if (!parsed.success) {
    return { success: false, error: 'Lütfen formu kontrol et', fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const data = parsed.data;
  const imagesArr = parseImages(formData.get('images'));

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
        featuredImageUrl: (imagesArr[0] || data.featuredImageUrl) || null,
        metadata: sql`COALESCE(${products.metadata}, '{}'::jsonb) || ${JSON.stringify({ images: imagesArr })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));

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

  await auditUser(admin.id!, 'admin.product.update', 'product', productId, {
    after: { title: data.title, status: data.status },
  });

  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${productId}`);
  return { success: true };
}

/** Admin: ürünü Shopify'a gönder/güncelle (current status'le). */
export async function adminPushProductAction(productId: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!existing) return { success: false, error: 'Ürün bulunamadı' };

  const result = await pushProductToShopify(productId);
  if (!result.ok) return { success: false, error: result.error };

  await auditUser(admin.id!, 'admin.shopify.product.push', 'product', productId, {
    after: { shopifyProductId: result.shopifyProductId, shopifyVariantId: result.shopifyVariantId },
  });

  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${productId}`);
  return { success: true };
}

/** Admin: hızlı durum değiştir (Yayına Al / Taslağa Al / Arşivle) + Shopify sync. */
export async function adminSetStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const productId = z.string().uuid().parse(formData.get('productId'));
  const status = z.enum(['active', 'draft', 'archived']).parse(formData.get('status'));

  const [row] = await db
    .update(products)
    .set({ status, updatedAt: new Date() })
    .where(eq(products.id, productId))
    .returning({ id: products.id, shopifyProductId: products.shopifyProductId });

  // Shopify sync: 'active' → her zaman push (yayınla/güncelle).
  // 'draft'/'archived' → sadece zaten Shopify'daysa push (gizle/güncelle).
  if (row) {
    const isPublished = !row.shopifyProductId.startsWith('local_');
    if (status === 'active' || isPublished) {
      await pushProductToShopify(productId).catch((e) =>
        console.error('[adminSetStatus] Shopify push hatası:', e),
      );
    }
  }

  await auditUser(admin.id!, 'admin.product.status', 'product', productId, { after: { status } });
  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${productId}`);
}

/** Admin: ürünü sil (soft delete) — Shopify'daysa önce orada arşivle, sonra sayacı düş. */
export async function adminDeleteProductAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const productId = z.string().uuid().parse(formData.get('productId'));

  const [p] = await db
    .select({ shopifyProductId: products.shopifyProductId, vendorId: products.vendorId })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!p) {
    revalidatePath('/admin/products');
    return;
  }

  // Shopify'da yayındaysa önce arşivle ki storefronttan kalksın (sipariş geçmişi korunur).
  if (!p.shopifyProductId.startsWith('local_')) {
    await db.update(products).set({ status: 'archived' }).where(eq(products.id, productId));
    await pushProductToShopify(productId).catch((e) =>
      console.error('[adminDelete] Shopify arşivleme hatası:', e),
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ deletedAt: new Date(), status: 'archived' })
      .where(eq(products.id, productId));
    await tx
      .update(vendors)
      .set({ productCount: sql`GREATEST(0, ${vendors.productCount} - 1)` })
      .where(eq(vendors.id, p.vendorId));
  });

  await auditUser(admin.id!, 'admin.product.delete', 'product', productId, {});
  revalidatePath('/admin/products');
}
