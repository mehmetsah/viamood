'use server';
/**
 * Tenant registry server actions — /admin/tenants paneli (yalnız admin).
 * Kayıtlar envanterdir: instance'a bağlanmaz, sadece tanımlar + health URL tutar.
 */
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { tenants } from '@/db/schema/tenants';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    throw new Error('Yetkisiz: admin gerekli');
  }
  return session;
}

const tenantSchema = z.object({
  name: z.string().min(2, 'İsim en az 2 karakter'),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Slug: küçük harf, rakam, tire'),
  storefrontUrl: z.string().url('Geçerli URL girin (https://...)'),
  appUrl: z.union([z.string().url(), z.literal('')]).optional(),
  shopifyDomain: z.string().optional(),
  dbName: z.string().optional(),
  status: z.enum(['provisioning', 'active', 'disabled']),
  notes: z.string().optional(),
});

export interface TenantActionResult {
  ok: boolean;
  error?: string;
}

function parseForm(formData: FormData) {
  return tenantSchema.safeParse({
    name: formData.get('name') ?? '',
    slug: formData.get('slug') ?? '',
    storefrontUrl: formData.get('storefrontUrl') ?? '',
    appUrl: formData.get('appUrl') ?? '',
    shopifyDomain: formData.get('shopifyDomain') ?? '',
    dbName: formData.get('dbName') ?? '',
    status: formData.get('status') ?? 'provisioning',
    notes: formData.get('notes') ?? '',
  });
}

export async function createTenantAction(_prev: TenantActionResult | null, formData: FormData): Promise<TenantActionResult> {
  await requireAdmin();
  const p = parseForm(formData);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Geçersiz form' };
  try {
    await db.insert(tenants).values({
      ...p.data,
      appUrl: p.data.appUrl || null,
      shopifyDomain: p.data.shopifyDomain || null,
      dbName: p.data.dbName || null,
      notes: p.data.notes || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.includes('unique') ? 'Bu slug zaten kayıtlı' : msg };
  }
  revalidatePath('/admin/tenants');
  return { ok: true };
}

export async function updateTenantAction(_prev: TenantActionResult | null, formData: FormData): Promise<TenantActionResult> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: 'id eksik' };
  const p = parseForm(formData);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Geçersiz form' };
  await db
    .update(tenants)
    .set({
      ...p.data,
      appUrl: p.data.appUrl || null,
      shopifyDomain: p.data.shopifyDomain || null,
      dbName: p.data.dbName || null,
      notes: p.data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id));
  revalidatePath('/admin/tenants');
  return { ok: true };
}

export async function deleteTenantAction(_prev: TenantActionResult | null, formData: FormData): Promise<TenantActionResult> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const [t] = await db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!t) return { ok: false, error: 'Kayıt bulunamadı' };
  if (t.slug === 'viamood') return { ok: false, error: 'Ana instance kaydı silinemez' };
  await db.delete(tenants).where(eq(tenants.id, id));
  revalidatePath('/admin/tenants');
  return { ok: true };
}
