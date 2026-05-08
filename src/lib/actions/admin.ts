'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import { users, vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';
import { auditUser } from '@/lib/audit/logger';
import { sendEmail } from '@/lib/email/sender';
import { vendorApprovedEmail, vendorRejectedEmail } from '@/lib/email/templates';

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

  // Email notification
  const [v] = await db.select({ name: vendors.name, email: vendors.email }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (v) {
    void sendEmail({ to: v.email, ...vendorApprovedEmail(v.name) });
  }

  revalidatePath('/admin/vendors');
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
