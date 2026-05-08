'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import { vendors } from '@/db/schema';
import { hashPassword, validatePassword, verifyPassword } from '@/lib/password';
import { auditUser } from '@/lib/audit/logger';
import { canEdit, requireVendor } from '@/lib/server/vendor-context';
import { auth } from '@/lib/auth';
import { users } from '@/db/schema';
import type { ActionResult } from './auth';

const profileSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().or(z.literal('')),
  email: z.string().email(),
  phone: z.string().min(10).max(20).optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  addressLine1: z.string().min(5).max(200),
  addressLine2: z.string().max(200).optional().or(z.literal('')),
  city: z.string().min(2).max(60),
  district: z.string().min(2).max(60),
  postalCode: z.string().max(10).optional().or(z.literal('')),
  iban: z
    .string()
    .regex(/^TR\d{24}$/i, 'IBAN TR ile başlayıp 26 hane olmalı')
    .optional()
    .or(z.literal('')),
  accountHolderName: z.string().max(120).optional().or(z.literal('')),
  bankName: z.string().max(120).optional().or(z.literal('')),
});

function diff<T extends Record<string, unknown>>(before: T, after: T): { before: Partial<T>; after: Partial<T> } {
  const beforePart: Record<string, unknown> = {};
  const afterPart: Record<string, unknown> = {};
  for (const key of Object.keys(after) as Array<keyof T>) {
    if (before[key] !== after[key]) {
      beforePart[key as string] = before[key];
      afterPart[key as string] = after[key];
    }
  }
  return { before: beforePart as Partial<T>, after: afterPart as Partial<T> };
}

export async function updateVendorProfileAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireVendor();
  if (!canEdit(ctx.role)) return { success: false, error: 'Yetkin yok' };

  const raw = {
    name: String(formData.get('name') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    website: String(formData.get('website') ?? '').trim(),
    addressLine1: String(formData.get('addressLine1') ?? '').trim(),
    addressLine2: String(formData.get('addressLine2') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim(),
    district: String(formData.get('district') ?? '').trim(),
    postalCode: String(formData.get('postalCode') ?? '').trim(),
    iban: String(formData.get('iban') ?? '').replace(/\s/g, '').toUpperCase(),
    accountHolderName: String(formData.get('accountHolderName') ?? '').trim(),
    bankName: String(formData.get('bankName') ?? '').trim(),
  };

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message;
    }
    return { success: false, error: 'Lütfen formu kontrol et', fieldErrors };
  }
  const data = parsed.data;

  const [before] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, ctx.vendorId))
    .limit(1);
  if (!before) return { success: false, error: 'Vendor bulunamadı' };

  const after = {
    name: data.name,
    description: data.description || null,
    email: data.email,
    phone: data.phone || null,
    website: data.website || null,
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2 || null,
    city: data.city,
    district: data.district,
    postalCode: data.postalCode || null,
    iban: data.iban || null,
    accountHolderName: data.accountHolderName || null,
    bankName: data.bankName || null,
  };

  await db
    .update(vendors)
    .set({ ...after, updatedAt: new Date() })
    .where(eq(vendors.id, ctx.vendorId));

  // Audit
  const beforeRecord: Record<string, unknown> = before as unknown as Record<string, unknown>;
  const afterRecord: Record<string, unknown> = after as unknown as Record<string, unknown>;
  const changes = diff(beforeRecord, afterRecord);
  await auditUser(ctx.userId, 'vendor.profile.update', 'vendor', ctx.vendorId, {
    before: changes.before as Record<string, unknown>,
    after: changes.after as Record<string, unknown>,
  });

  revalidatePath('/profile');
  revalidatePath('/dashboard');
  return { success: true };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string(),
});

export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Giriş yapmadın' };

  const parsed = passwordSchema.safeParse({
    currentPassword: String(formData.get('currentPassword') ?? ''),
    newPassword: String(formData.get('newPassword') ?? ''),
  });
  if (!parsed.success) return { success: false, error: 'Geçersiz form' };

  const policy = validatePassword(parsed.data.newPassword);
  if (!policy.ok) {
    return {
      success: false,
      error: policy.reason,
      fieldErrors: { newPassword: policy.reason },
    };
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user || !user.passwordHash) return { success: false, error: 'Kullanıcı bulunamadı' };

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return {
      success: false,
      error: 'Mevcut şifre hatalı',
      fieldErrors: { currentPassword: 'Mevcut şifre hatalı' },
    };
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

  await auditUser(user.id, 'user.password.change', 'user', user.id);

  return { success: true };
}
