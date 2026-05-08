import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Minimum password policy.
 * - 8+ chars
 * - 1 lowercase, 1 uppercase, 1 digit
 * Reject extremely common passwords (no list yet — Phase 5'te zxcvbn ekleyebiliriz).
 */
export function validatePassword(password: string): { ok: true } | { ok: false; reason: string } {
  if (password.length < 8) return { ok: false, reason: 'Şifre en az 8 karakter olmalı' };
  if (!/[a-z]/.test(password)) return { ok: false, reason: 'Şifre en az 1 küçük harf içermeli' };
  if (!/[A-Z]/.test(password)) return { ok: false, reason: 'Şifre en az 1 büyük harf içermeli' };
  if (!/[0-9]/.test(password)) return { ok: false, reason: 'Şifre en az 1 rakam içermeli' };
  return { ok: true };
}
