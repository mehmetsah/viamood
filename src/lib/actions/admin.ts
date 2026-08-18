'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import { users, vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';
import { auditUser } from '@/lib/audit/logger';
import { createKargoLabMemberForVendor } from '@/lib/kargolab/vendor-member';
import { sendEmail } from '@/lib/email/sender';
import { vendorApprovedEmail, vendorRejectedEmail } from '@/lib/email/templates';
import { createSubmerchant } from '@/lib/iyzico/client';
import { registerShopifyWebhooks } from '@/lib/shopify/webhooks-register';
import type { ActionResult } from './auth';

async function requireAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'admin' && role !== 'super_admin')) {
    throw new Error('Unauthorized: admin yetkisi gerekli');
  }
  return session.user;
}

export async function approveVendorAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const vendorId = z.string().uuid().parse(formData.get('vendorId'));

  await db.transaction(async (tx) => {
    await tx
      .update(vendors)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(vendors.id, vendorId));

    const owners = await tx
      .select({ userId: vendorMemberships.userId })
      .from(vendorMemberships)
      .where(eq(vendorMemberships.vendorId, vendorId));

    for (const o of owners) {
      await tx.update(users).set({ role: 'vendor_admin' }).where(eq(users.id, o.userId));
    }
  });

  await auditUser(admin.id!, 'vendor.approve', 'vendor', vendorId, {
    after: { status: 'active' },
  });

  // Iyzico submerchant — vendor onaylanır onaylanmaz subaccount yarat (best-effort).
  // Hata olursa sadece audit log kalır, vendor approve etkilenmez.
  void createIyzicoSubmerchantForVendor(vendorId, admin.id!).catch((err) => {
    console.error('[iyzico submerchant] create failed:', err);
  });

  // KargoLab üyesi — tedarikçi Via Mood TENANT'ında (kargo.viamood.com.tr) ayrı üye
  // olarak açılır; panelindeki kargo/cari bölümü buna dayanır. Iyzico ile aynı desen:
  // best-effort, hata onayı geri almaz (hata vendors.kargolabSyncError'a yazılır).
  void createKargoLabMemberForVendor(vendorId).catch((err) => {
    console.error('[kargolab member] create failed:', err);
  });

  // Email notification
  const [v] = await db.select({ name: vendors.name, email: vendors.email }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (v) {
    void sendEmail({ to: v.email, ...vendorApprovedEmail(v.name) });
  }

  revalidatePath('/admin/vendors');
}

async function createIyzicoSubmerchantForVendor(
  vendorId: string,
  adminUserId: string,
): Promise<void> {
  const [v] = await db
    .select({
      id: vendors.id,
      name: vendors.name,
      legalName: vendors.legalName,
      email: vendors.email,
      phone: vendors.phone,
      taxId: vendors.taxId,
      taxOffice: vendors.taxOffice,
      iban: vendors.iban,
      addressLine1: vendors.addressLine1,
      city: vendors.city,
      district: vendors.district,
      postalCode: vendors.postalCode,
      country: vendors.country,
      iyzicoSubmerchantKey: vendors.iyzicoSubmerchantKey,
    })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!v) return;
  if (v.iyzicoSubmerchantKey) return; // Zaten var
  if (!v.iban) {
    console.warn(`[iyzico] vendor ${vendorId} IBAN yok, submerchant create skip`);
    return;
  }

  const isCorporate = !!v.taxOffice && !!v.taxId && v.taxId.length === 10;
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

  await auditUser(adminUserId, 'iyzico.submerchant.created', 'vendor', vendorId, {
    after: { subMerchantKey: result.subMerchantKey },
  });
}

export async function rejectVendorAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const vendorId = z.string().uuid().parse(formData.get('vendorId'));
  const reason = String(formData.get('reason') ?? '').slice(0, 500);

  await db
    .update(vendors)
    .set({ status: 'rejected', suspendedReason: reason || 'Admin red', updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));

  await auditUser(admin.id!, 'vendor.reject', 'vendor', vendorId, {
    after: { status: 'rejected', reason },
  });

  // Email
  const [v] = await db.select({ name: vendors.name, email: vendors.email }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (v) {
    void sendEmail({ to: v.email, ...vendorRejectedEmail(v.name, reason || 'Belirtilmedi') });
  }

  revalidatePath('/admin/vendors');
}

export async function suspendVendorAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const vendorId = z.string().uuid().parse(formData.get('vendorId'));
  const reason = String(formData.get('reason') ?? '').slice(0, 500);

  await db
    .update(vendors)
    .set({ status: 'suspended', suspendedReason: reason, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));

  await auditUser(admin.id!, 'vendor.suspend', 'vendor', vendorId, {
    after: { status: 'suspended', reason },
  });
  revalidatePath('/admin/vendors');
}

export async function setCommissionAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const vendorId = z.string().uuid().parse(formData.get('vendorId'));
  const rateBpsRaw = String(formData.get('commissionRate') ?? '0');
  const rateBps = Math.max(0, Math.min(10000, Math.round(Number(rateBpsRaw) * 100))); // % → bps

  const [before] = await db
    .select({ commissionRate: vendors.commissionRate })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  await db
    .update(vendors)
    .set({ commissionRate: rateBps, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));

  await auditUser(admin.id!, 'vendor.commission.set', 'vendor', vendorId, {
    before: { commissionRate: before?.commissionRate ?? 0 },
    after: { commissionRate: rateBps },
  });
  revalidatePath('/admin/vendors');
}

export async function syncIyzicoSubmerchantAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const vendorId = z.string().uuid().parse(formData.get('vendorId'));
  try {
    await createIyzicoSubmerchantForVendor(vendorId, admin.id!);
    revalidatePath('/admin/vendors');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

export async function registerWebhooksAction(
  _prev: unknown,
  formData: FormData,
): Promise<{
  success: boolean;
  message: string;
  details?: Awaited<ReturnType<typeof registerShopifyWebhooks>>;
}> {
  const admin = await requireAdmin();
  const overrideUrl = String(formData.get('appUrl') ?? '').trim() || undefined;

  try {
    const result = await registerShopifyWebhooks(overrideUrl);
    await auditUser(admin.id!, 'shopify.webhooks.register', 'shopify_connection', undefined, {
      after: {
        callbackUrl: result.callbackUrl,
        created: result.created.length,
        alreadyExists: result.alreadyExists.length,
        errors: result.errors.length,
      },
    });
    revalidatePath('/admin/shopify');
    const messages: string[] = [];
    if (result.created.length > 0)
      messages.push(`${result.created.length} webhook oluşturuldu`);
    if (result.alreadyExists.length > 0)
      messages.push(`${result.alreadyExists.length} webhook zaten mevcut`);
    if (result.errors.length > 0)
      messages.push(`${result.errors.length} hata`);
    return { success: result.errors.length === 0, message: messages.join(', ') || 'No-op', details: result };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Bilinmeyen hata',
    };
  }
}
