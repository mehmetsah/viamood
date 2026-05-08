'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db/client';
import { vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';
import type { ActionResult } from './auth';

const onboardingSchema = z.object({
  name: z.string().min(2, 'Mağaza adı en az 2 karakter').max(120),
  legalName: z.string().min(2, 'Yasal unvan en az 2 karakter').max(200),
  taxId: z.string().min(10, 'Vergi numarası 10-11 hane').max(11),
  taxOffice: z.string().min(2, 'Vergi dairesi gerekli').max(120),
  phone: z.string().min(10, 'Geçerli bir telefon').max(20),
  email: z.string().email('Geçerli bir e-posta'),
  addressLine1: z.string().min(5, 'Adres gerekli').max(200),
  city: z.string().min(2).max(60),
  district: z.string().min(2).max(60),
  postalCode: z.string().max(10).optional(),
  iban: z
    .string()
    .regex(/^TR\d{24}$/i, 'IBAN TR ile başlayıp 26 hane olmalı')
    .optional()
    .or(z.literal('')),
  accountHolderName: z.string().max(120).optional().or(z.literal('')),
  description: z.string().max(1000).optional().or(z.literal('')),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function vendorOnboardingAction(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Önce giriş yapmalısın' };
  }

  const raw = {
    name: String(formData.get('name') ?? '').trim(),
    legalName: String(formData.get('legalName') ?? '').trim(),
    taxId: String(formData.get('taxId') ?? '').trim(),
    taxOffice: String(formData.get('taxOffice') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    addressLine1: String(formData.get('addressLine1') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim(),
    district: String(formData.get('district') ?? '').trim(),
    postalCode: String(formData.get('postalCode') ?? '').trim(),
    iban: String(formData.get('iban') ?? '').replace(/\s/g, '').toUpperCase(),
    accountHolderName: String(formData.get('accountHolderName') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
  };

  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message;
    }
    return { success: false, error: 'Lütfen formu kontrol et', fieldErrors };
  }
  const data = parsed.data;

  // User'a bağlı vendor zaten var mı?
  const existing = await db
    .select({ vendorId: vendorMemberships.vendorId })
    .from(vendorMemberships)
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (existing.length > 0) {
    return { success: false, error: 'Zaten bir tedarikçi başvurun var' };
  }

  // Unique slug üret
  let baseSlug = slugify(data.name) || 'vendor';
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const conflict = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.slug, slug)).limit(1);
    if (conflict.length === 0) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // Transaction: vendor + membership
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(vendors)
      .values({
        slug,
        name: data.name,
        legalName: data.legalName,
        email: data.email,
        phone: data.phone,
        description: data.description || null,
        taxId: data.taxId,
        taxOffice: data.taxOffice,
        addressLine1: data.addressLine1,
        city: data.city,
        district: data.district,
        postalCode: data.postalCode || null,
        country: 'TR',
        iban: data.iban || null,
        accountHolderName: data.accountHolderName || null,
        status: 'pending',
        commissionRate: 0,
        paymentMode: 'cari',
      })
      .returning({ id: vendors.id });

    if (!created) throw new Error('Vendor kaydı oluşturulamadı');

    await tx.insert(vendorMemberships).values({
      userId: session.user.id,
      vendorId: created.id,
      role: 'owner',
      acceptedAt: new Date(),
    });
  });

  redirect('/dashboard');
}
