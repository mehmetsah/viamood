'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auditUser } from '@/lib/audit/logger';
import {
  archiveBundle,
  createBundle,
  prepareBundleStock,
  setBundleStatus,
  unprepareBundleStock,
  type CreateBundleInput,
} from '@/lib/server/bundle-service';
import { canEdit, requireActiveVendor } from '@/lib/server/vendor-context';
import { auth } from '@/lib/auth';
import { pushBundleToShopify } from '@/lib/shopify/bundles';
import type { ActionResult } from './auth';

const componentSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
});

const createSchema = z.object({
  title: z.string().min(2).max(255),
  sku: z.string().min(2).max(120),
  handle: z.string().min(2).max(120),
  description: z.string().max(8000).optional(),
  featuredImageUrl: z.string().url().optional().or(z.literal('')),
  /** Auto-derived from component variants; manuel override edilebilir */
  galleryImageUrls: z.array(z.string().url()).max(10).default([]),
  bundlePriceCents: z.coerce.number().int().min(1),
  initialSetCount: z.coerce.number().int().min(0).default(0),
  packageWeightGrams: z.coerce.number().int().min(0).optional(),
  packageLengthCm: z.coerce.number().min(0).optional(),
  packageWidthCm: z.coerce.number().min(0).optional(),
  packageHeightCm: z.coerce.number().min(0).optional(),
  components: z.array(componentSchema).min(2),
  /** Admin karma bundle (vendor=null) için true */
  isAdminMixed: z.boolean().default(false),
});

function moneyToCents(v: string | number): number {
  if (typeof v === 'number') return Math.round(v * 100);
  const cleaned = String(v).replace(/[^\d.,]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function slugifyHandle(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function createBundleAction(formData: FormData): Promise<void> {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id) throw new Error('Unauthorized');

  const isAdmin = role === 'admin' || role === 'super_admin';

  // Components form data'da JSON string olarak gelir
  const componentsJson = String(formData.get('components') ?? '[]');
  let components: z.infer<typeof componentSchema>[];
  try {
    components = JSON.parse(componentsJson);
  } catch {
    throw new Error('Geçersiz komponent verisi');
  }

  // Gallery — auto-derived from variant images on client, JSON dizi olarak gelir
  let galleryImageUrls: string[] = [];
  try {
    const raw = String(formData.get('galleryImageUrls') ?? '[]');
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      galleryImageUrls = parsed
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .slice(0, 10);
    }
  } catch {
    // boş bırak
  }

  const isAdminMixed = formData.get('isAdminMixed') === '1' && isAdmin;

  const raw = {
    title: String(formData.get('title') ?? '').trim(),
    sku: String(formData.get('sku') ?? '').trim(),
    handle: String(formData.get('handle') ?? '').trim() || slugifyHandle(String(formData.get('title') ?? '')) + '-set',
    description: String(formData.get('description') ?? ''),
    featuredImageUrl: String(formData.get('featuredImageUrl') ?? '').trim(),
    galleryImageUrls,
    bundlePriceCents: moneyToCents(String(formData.get('bundlePrice') ?? '0')),
    initialSetCount: Number(formData.get('initialSetCount') ?? 0),
    packageWeightGrams: formData.get('packageWeightGrams')
      ? Number(formData.get('packageWeightGrams'))
      : undefined,
    packageLengthCm: formData.get('packageLengthCm')
      ? Number(formData.get('packageLengthCm'))
      : undefined,
    packageWidthCm: formData.get('packageWidthCm')
      ? Number(formData.get('packageWidthCm'))
      : undefined,
    packageHeightCm: formData.get('packageHeightCm')
      ? Number(formData.get('packageHeightCm'))
      : undefined,
    components,
    isAdminMixed,
  };

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Form hatası');
  }
  const data = parsed.data;

  // Vendor scope belirle
  let vendorId: string | null = null;
  if (isAdmin && data.isAdminMixed) {
    vendorId = null; // karma bundle
  } else {
    const ctx = await requireActiveVendor();
    if (!canEdit(ctx.role)) throw new Error('Yetkin yok');
    vendorId = ctx.vendorId;
  }

  const input: CreateBundleInput = {
    vendorId,
    title: data.title,
    sku: data.sku,
    handle: data.handle,
    description: data.description || undefined,
    featuredImageUrl: data.featuredImageUrl || undefined,
    galleryImageUrls: data.galleryImageUrls,
    bundlePriceCents: data.bundlePriceCents,
    initialSetCount: data.initialSetCount,
    packageWeightGrams: data.packageWeightGrams,
    packageDimensionsCm:
      data.packageLengthCm && data.packageWidthCm && data.packageHeightCm
        ? {
            length: data.packageLengthCm,
            width: data.packageWidthCm,
            height: data.packageHeightCm,
          }
        : undefined,
    components: data.components,
  };

  const result = await createBundle(input);
  if (!result.ok) {
    throw new Error(result.error);
  }

  await auditUser(
    session.user.id,
    'bundle.create',
    'bundle',
    result.bundleId,
    { after: { title: data.title, sku: data.sku, vendorId, setCount: data.initialSetCount } },
  );

  revalidatePath('/bundles');
  revalidatePath('/admin/bundles');
  redirect(isAdmin && isAdminMixed ? `/admin/bundles/${result.bundleId}` : `/bundles/${result.bundleId}`);
}

export async function prepareBundleStockAction(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };
  const bundleId = z.string().uuid().parse(formData.get('bundleId'));
  const setCount = z.coerce.number().int().min(1).parse(formData.get('setCount'));
  const res = await prepareBundleStock(bundleId, setCount);
  if (!res.ok) return { success: false, error: res.error };
  await auditUser(session.user.id, 'bundle.stock.prepare', 'bundle', bundleId, {
    after: { addedSets: setCount, newInventory: res.newInventory },
  });
  revalidatePath(`/bundles/${bundleId}`);
  revalidatePath(`/admin/bundles/${bundleId}`);
  return { success: true };
}

export async function unprepareBundleStockAction(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };
  const bundleId = z.string().uuid().parse(formData.get('bundleId'));
  const setCount = z.coerce.number().int().min(1).parse(formData.get('setCount'));
  const res = await unprepareBundleStock(bundleId, setCount);
  if (!res.ok) return { success: false, error: res.error };
  await auditUser(session.user.id, 'bundle.stock.unprepare', 'bundle', bundleId, {
    after: { removedSets: setCount, newInventory: res.newInventory },
  });
  revalidatePath(`/bundles/${bundleId}`);
  return { success: true };
}

export async function toggleBundleStatusAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const bundleId = z.string().uuid().parse(formData.get('bundleId'));
  const status = z.enum(['draft', 'active']).parse(formData.get('status'));
  await setBundleStatus(bundleId, status);
  await auditUser(session.user.id, `bundle.status.${status}`, 'bundle', bundleId);

  // Aktif olunca otomatik Shopify push (best-effort, hata olursa log'la geç)
  if (status === 'active') {
    try {
      const r = await pushBundleToShopify(bundleId);
      if (r.ok) {
        await auditUser(session.user.id, 'bundle.shopify.push.auto', 'bundle', bundleId, {
          after: { productId: r.shopifyProductId, variantId: r.shopifyVariantId },
        });
      } else {
        console.error('[bundle auto-push] failed:', r.error);
      }
    } catch (e) {
      console.error('[bundle auto-push] exception:', e);
    }
  }

  revalidatePath(`/bundles/${bundleId}`);
  revalidatePath(`/admin/bundles/${bundleId}`);
}

export async function pushBundleToShopifyAction(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };
  const bundleId = z.string().uuid().parse(formData.get('bundleId'));
  const res = await pushBundleToShopify(bundleId);
  if (!res.ok) return { success: false, error: res.error };
  await auditUser(session.user.id, 'bundle.shopify.push.manual', 'bundle', bundleId, {
    after: { productId: res.shopifyProductId, variantId: res.shopifyVariantId, handle: res.shopifyHandle },
  });
  revalidatePath(`/bundles/${bundleId}`);
  revalidatePath(`/admin/bundles/${bundleId}`);
  return { success: true };
}

export async function archiveBundleAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const bundleId = z.string().uuid().parse(formData.get('bundleId'));
  const res = await archiveBundle(bundleId);
  if (!res.ok) throw new Error(res.error);
  await auditUser(session.user.id, 'bundle.archive', 'bundle', bundleId);
  revalidatePath('/bundles');
  revalidatePath('/admin/bundles');
}
