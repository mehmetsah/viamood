'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import {
  consumeResetToken,
  requestPasswordReset,
  RESET_TOKEN_TTL_MS,
} from '@/lib/password-reset';
import { validatePassword } from '@/lib/password';
import type { ActionResult } from './auth';

/**
 * Kayıtlı olsun olmasın HER durumda gösterilen mesaj.
 * Kullanıcı sayımını (e-posta sistemde var mı) sızdırmamak için tek metin.
 */
const NOTR_MESAJ =
  'E-posta adresin kayıtlıysa şifre sıfırlama bağlantısını gönderdik. Gelen kutunu (ve spam klasörünü) kontrol et.';

const emailSchema = z.object({
  email: z.string().email('Geçerli bir e-posta gir'),
});

/** nginx arkasında gerçek istemci IP'si X-Forwarded-For'un İLK değeridir. */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || null;
  return h.get('x-real-ip');
}

export async function requestPasswordResetAction(formData: FormData): Promise<ActionResult> {
  const parsed = emailSchema.safeParse({
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: 'Lütfen formu kontrol et',
      fieldErrors: { email: parsed.error.issues[0]?.message ?? 'Geçerli bir e-posta gir' },
    };
  }

  const res = await requestPasswordReset({
    email: parsed.data.email,
    ip: await clientIp(),
  });

  if (!res.ok) {
    return {
      success: false,
      error: 'Çok fazla deneme yapıldı. Lütfen bir saat sonra tekrar dene.',
    };
  }

  // DİKKAT: res.emailSent'e göre farklı mesaj DÖNDÜRME — e-postanın kayıtlı olup
  // olmadığını ele verir.
  return { success: true, data: { message: NOTR_MESAJ } };
}

const resetSchema = z.object({
  token: z.string().min(1, 'Bağlantı geçersiz'),
  password: z.string(),
  passwordConfirm: z.string(),
});

export async function resetPasswordAction(formData: FormData): Promise<ActionResult> {
  const parsed = resetSchema.safeParse({
    token: String(formData.get('token') ?? ''),
    password: String(formData.get('password') ?? ''),
    passwordConfirm: String(formData.get('passwordConfirm') ?? ''),
  });
  if (!parsed.success) {
    return { success: false, error: 'Bağlantı geçersiz. Lütfen sıfırlamayı yeniden başlat.' };
  }

  const { token, password, passwordConfirm } = parsed.data;

  if (password !== passwordConfirm) {
    return {
      success: false,
      error: 'Şifreler eşleşmiyor',
      fieldErrors: { passwordConfirm: 'Şifreler eşleşmiyor' },
    };
  }

  const policy = validatePassword(password);
  if (!policy.ok) {
    return { success: false, error: policy.reason, fieldErrors: { password: policy.reason } };
  }

  const res = await consumeResetToken({ token, newPassword: password });
  if (!res.ok) {
    const saat = Math.round(RESET_TOKEN_TTL_MS / 3_600_000);
    const mesaj =
      res.reason === 'expired'
        ? `Bu bağlantının süresi dolmuş (${saat} saat geçerliydi). Lütfen yeni bir bağlantı iste.`
        : res.reason === 'used'
          ? 'Bu bağlantı daha önce kullanılmış. Lütfen yeni bir bağlantı iste.'
          : 'Bağlantı geçersiz. Lütfen yeni bir bağlantı iste.';
    return { success: false, error: mesaj };
  }

  return { success: true, data: { email: res.email } };
}
