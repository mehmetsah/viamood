'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { signIn } from '@/lib/auth';
import { env } from '@/lib/env';
import { upsertCustomerByEmail } from '@/lib/customers/service';
import { hashPassword, validatePassword } from '@/lib/password';

const signUpSchema = z.object({
  name: z.string().min(2, 'Ad-soyad en az 2 karakter olmalı').max(120),
  email: z.string().email('Geçerli bir e-posta gir'),
  password: z.string(),
  passwordConfirm: z.string(),
});

export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export async function signUpAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    password: String(formData.get('password') ?? ''),
    passwordConfirm: String(formData.get('passwordConfirm') ?? ''),
  };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.');
      fieldErrors[key] = issue.message;
    }
    return { success: false, error: 'Lütfen formu kontrol et', fieldErrors };
  }

  const data = parsed.data;

  if (data.password !== data.passwordConfirm) {
    return {
      success: false,
      error: 'Şifreler eşleşmiyor',
      fieldErrors: { passwordConfirm: 'Şifreler eşleşmiyor' },
    };
  }

  const policy = validatePassword(data.password);
  if (!policy.ok) {
    return {
      success: false,
      error: policy.reason,
      fieldErrors: { password: policy.reason },
    };
  }

  // Email taken?
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1);
  if (existing.length > 0) {
    return {
      success: false,
      error: 'Bu e-posta ile zaten kayıt var',
      fieldErrors: { email: 'Bu e-posta ile zaten kayıt var' },
    };
  }

  const passwordHash = await hashPassword(data.password);
  const [created] = await db
    .insert(users)
    .values({
      name: data.name,
      email: data.email,
      passwordHash,
      role: 'vendor', // sign-up'tan gelen herkes önce vendor (KYC sonrası vendor_admin olur)
    })
    .returning({ id: users.id, email: users.email });

  if (!created) {
    return { success: false, error: 'Kayıt oluşturulamadı, lütfen tekrar dene' };
  }

  // Auto sign-in (NextAuth credentials)
  await signIn('credentials', {
    email: data.email,
    password: data.password,
    redirect: false,
  });

  redirect('/onboarding');
}

/**
 * Müşteri kaydı (FAZ 1). signUpAction'dan AYRI: role='customer', onboarding YOK,
 * RDS customers'a bağlanır (userId), /hesabim'a yönlendirir.
 */
export async function customerSignUpAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    password: String(formData.get('password') ?? ''),
    passwordConfirm: String(formData.get('passwordConfirm') ?? ''),
  };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message;
    }
    return { success: false, error: 'Lütfen formu kontrol et', fieldErrors };
  }

  const data = parsed.data;

  if (data.password !== data.passwordConfirm) {
    return {
      success: false,
      error: 'Şifreler eşleşmiyor',
      fieldErrors: { passwordConfirm: 'Şifreler eşleşmiyor' },
    };
  }

  const policy = validatePassword(data.password);
  if (!policy.ok) {
    return { success: false, error: policy.reason, fieldErrors: { password: policy.reason } };
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1);
  if (existing.length > 0) {
    return {
      success: false,
      error: 'Bu e-posta ile zaten kayıt var',
      fieldErrors: { email: 'Bu e-posta ile zaten kayıt var' },
    };
  }

  const passwordHash = await hashPassword(data.password);
  const [created] = await db
    .insert(users)
    .values({ name: data.name, email: data.email, passwordHash, role: 'customer' })
    .returning({ id: users.id, email: users.email });

  if (!created) {
    return { success: false, error: 'Kayıt oluşturulamadı, lütfen tekrar dene' };
  }

  // RDS customers'a bağla (email köprüsü) — backfill'den gelen satır varsa userId'yi ona yazar,
  // böylece geçmiş siparişler portal'da hemen görünür. Best-effort.
  await upsertCustomerByEmail({
    email: data.email,
    name: data.name,
    userId: created.id,
  });

  await signIn('credentials', { email: data.email, password: data.password, redirect: false });

  redirect('/hesabim');
}

export async function signOutAction() {
  const { signOut } = await import('@/lib/auth');
  await signOut({ redirectTo: '/' });
}

/**
 * MÜŞTERİ hesabı çıkışı (hesap.viamood.com.tr) → ANA SİTEYE döner.
 *
 * signOutAction'ı burada kullanamayız: onun hedefi '/' ve bu alan adında kök,
 * hesap uygulamasının kendi ana sayfası — müşteri çıkış yapınca oraya düşüp
 * sitenin eski sürümünü görüyordu (Yunus, 12 Ağu). Admin/tedarikçi çıkışı
 * uygulama içinde kalmalı, o yüzden ayrı bir action.
 *
 * `signOut({ redirectTo })` DEĞİL: NextAuth harici (farklı origin) hedefleri
 * güvenlik gereği eler. Önce oturumu kapat, sonra Next'in redirect'i ile mutlak
 * URL'e git. Giriş akışına (callbackUrl=/hesabim) dokunulmaz.
 */
export async function signOutToStorefrontAction() {
  const { signOut } = await import('@/lib/auth');
  await signOut({ redirect: false });
  redirect(env.STOREFRONT_URL);
}
