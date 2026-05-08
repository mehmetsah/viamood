'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import { users, vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';

async function requireAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'admin' && role !== 'super_admin')) {
    throw new Error('Unauthorized: admin yetkisi gerekli');
  }
  return session.user;
}

export async function approveVendorAction(formData: FormData): Promise<void> {
  await requireAdmin();
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

  revalidatePath('/admin/vendors');
}

export async function rejectVendorAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const vendorId = z.string().uuid().parse(formData.get('vendorId'));
  const reason = String(formData.get('reason') ?? '').slice(0, 500);

  await db
    .update(vendors)
    .set({ status: 'rejected', suspendedReason: reason || 'Admin red', updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));

  revalidatePath('/admin/vendors');
}

export async function suspendVendorAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const vendorId = z.string().uuid().parse(formData.get('vendorId'));
  const reason = String(formData.get('reason') ?? '').slice(0, 500);

  await db
    .update(vendors)
    .set({ status: 'suspended', suspendedReason: reason, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));

  revalidatePath('/admin/vendors');
}

export async function setCommissionAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const vendorId = z.string().uuid().parse(formData.get('vendorId'));
  const rateBpsRaw = String(formData.get('commissionRate') ?? '0');
  const rateBps = Math.max(0, Math.min(10000, Math.round(Number(rateBpsRaw) * 100))); // % → bps

  await db
    .update(vendors)
    .set({ commissionRate: rateBps, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));

  revalidatePath('/admin/vendors');
}
