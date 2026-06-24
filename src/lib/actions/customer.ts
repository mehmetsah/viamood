'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import { customerAddresses, customers, users } from '@/db/schema';
import { type ActionResult } from '@/lib/actions/auth';
import { upsertCustomerAddressRds } from '@/lib/customers/service';
import { getSessionCustomer } from '@/lib/customers/session';
import { hashPassword, validatePassword, verifyPassword } from '@/lib/password';
import { findOrCreateShopifyCustomer } from '@/lib/shopify/customer-search';
import { getStore } from '@/lib/store';

type SessionCustomer = { userId: string; customer: typeof customers.$inferSelect };

/** Oturumdaki müşteriyi getir; userId yoksa (rolsüz) null. */
async function requireCustomer(): Promise<SessionCustomer | null> {
  const cust = await getSessionCustomer();
  return cust?.userId ? { userId: cust.userId, customer: cust } : null;
}

const addressSchema = z.object({
  label: z.string().max(40).optional(),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  phone: z.string().max(30).optional(),
  province: z.string().min(1, 'İl seçin').max(40),
  district: z.string().min(1, 'İlçe seçin').max(60),
  neighborhood: z.string().max(120).optional(),
  address1: z.string().min(5, 'Açık adresi girin').max(300),
  postalCode: z.string().max(12).optional(),
});

function parseAddress(formData: FormData) {
  return addressSchema.safeParse({
    label: String(formData.get('label') ?? '').trim() || undefined,
    firstName: String(formData.get('firstName') ?? '').trim() || undefined,
    lastName: String(formData.get('lastName') ?? '').trim() || undefined,
    phone: String(formData.get('phone') ?? '').trim() || undefined,
    province: String(formData.get('province') ?? '').trim(),
    district: String(formData.get('district') ?? '').trim(),
    neighborhood: String(formData.get('neighborhood') ?? '').trim() || undefined,
    address1: String(formData.get('address1') ?? '').trim(),
    postalCode: String(formData.get('postalCode') ?? '').trim() || undefined,
  });
}

/**
 * Adresi Shopify'a senkronla (best-effort) → checkout "Kayıtlı adreslerim" selector'ı çalışsın.
 * Shopify customer yoksa email ile bul/oluştur, id'yi customers'a geri yaz.
 * ⚠️ Shopify alanları: province=il, city=ilçe, address2=mahalle.
 */
async function syncAddressToShopify(
  customer: typeof customers.$inferSelect,
  a: z.infer<typeof addressSchema>,
): Promise<void> {
  try {
    let shopifyId = customer.shopifyCustomerId;
    if (!shopifyId) {
      shopifyId = await findOrCreateShopifyCustomer(customer.email, customer.name);
      if (shopifyId) {
        await db.update(customers).set({ shopifyCustomerId: shopifyId, updatedAt: new Date() }).where(eq(customers.id, customer.id));
      }
    }
    if (!shopifyId) return;
    await getStore().upsertCustomerAddress({
      customerId: Number(shopifyId),
      first_name: a.firstName,
      last_name: a.lastName,
      phone: a.phone,
      address1: a.address1,
      address2: a.neighborhood, // mahalle
      city: a.district, // ilçe
      province: a.province, // il
      zip: a.postalCode,
    });
  } catch {
    /* best-effort */
  }
}

export async function addAddressAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireCustomer();
  if (!ctx) return { success: false, error: 'Oturum bulunamadı' };

  const parsed = parseAddress(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join('.')] = i.message;
    return { success: false, error: 'Lütfen adresi kontrol et', fieldErrors };
  }
  const a = parsed.data;
  const makeDefault = formData.get('isDefault') === 'on';

  await upsertCustomerAddressRds({
    customerId: ctx.customer.id,
    label: a.label,
    firstName: a.firstName,
    lastName: a.lastName,
    phone: a.phone,
    province: a.province,
    district: a.district,
    neighborhood: a.neighborhood,
    address1: a.address1,
    postalCode: a.postalCode,
    isDefault: makeDefault,
  });

  await syncAddressToShopify(ctx.customer, a);
  revalidatePath('/hesabim/adresler');
  return { success: true };
}

export async function updateAddressAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireCustomer();
  if (!ctx) return { success: false, error: 'Oturum bulunamadı' };

  const id = String(formData.get('id') ?? '');
  if (!id) return { success: false, error: 'Adres bulunamadı' };

  const parsed = parseAddress(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join('.')] = i.message;
    return { success: false, error: 'Lütfen adresi kontrol et', fieldErrors };
  }
  const a = parsed.data;
  const makeDefault = formData.get('isDefault') === 'on';

  if (makeDefault) {
    await db.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.customerId, ctx.customer.id));
  }
  // Sahiplik: WHERE id = ? AND customer_id = ? → başka müşterinin adresi güncellenemez
  const updated = await db
    .update(customerAddresses)
    .set({
      label: a.label ?? null,
      firstName: a.firstName ?? null,
      lastName: a.lastName ?? null,
      phone: a.phone ?? null,
      province: a.province,
      district: a.district,
      neighborhood: a.neighborhood ?? null,
      address1: a.address1,
      postalCode: a.postalCode ?? null,
      isDefault: makeDefault,
      updatedAt: new Date(),
    })
    .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, ctx.customer.id)))
    .returning({ id: customerAddresses.id });
  if (updated.length === 0) return { success: false, error: 'Adres bulunamadı' };

  await syncAddressToShopify(ctx.customer, a);
  revalidatePath('/hesabim/adresler');
  return { success: true };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const ctx = await requireCustomer();
  if (!ctx) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await db
    .delete(customerAddresses)
    .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, ctx.customer.id)));
  revalidatePath('/hesabim/adresler');
}

export async function setDefaultAddressAction(formData: FormData): Promise<void> {
  const ctx = await requireCustomer();
  if (!ctx) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await db.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.customerId, ctx.customer.id));
  await db
    .update(customerAddresses)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, ctx.customer.id)));
  revalidatePath('/hesabim/adresler');
}

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireCustomer();
  if (!ctx) return { success: false, error: 'Oturum bulunamadı' };

  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  if (name.length < 2) {
    return { success: false, error: 'Ad-soyad en az 2 karakter olmalı', fieldErrors: { name: 'En az 2 karakter' } };
  }

  await db.update(users).set({ name }).where(eq(users.id, ctx.userId));
  await db.update(customers).set({ name, phone: phone || null, updatedAt: new Date() }).where(eq(customers.id, ctx.customer.id));
  revalidatePath('/hesabim/profil');
  return { success: true };
}

export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireCustomer();
  if (!ctx) return { success: false, error: 'Oturum bulunamadı' };

  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const [u] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, ctx.userId)).limit(1);
  if (!u?.passwordHash || !(await verifyPassword(current, u.passwordHash))) {
    return { success: false, error: 'Mevcut şifre hatalı', fieldErrors: { current: 'Hatalı' } };
  }
  if (next !== confirm) {
    return { success: false, error: 'Yeni şifreler eşleşmiyor', fieldErrors: { confirm: 'Eşleşmiyor' } };
  }
  const policy = validatePassword(next);
  if (!policy.ok) return { success: false, error: policy.reason, fieldErrors: { next: policy.reason } };

  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, ctx.userId));
  return { success: true };
}
