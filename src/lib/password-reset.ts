/**
 * "Şifremi unuttum" servis katmanı.
 *
 * Güvenlik değişmezleri (bunları bozma):
 *  1. KULLANICI SAYIMI SIZMAZ. Çağıran taraf, e-posta kayıtlı olsun olmasın
 *     AYNI sonucu ve AYNI mesajı görür. Bu yüzden `requestReset` hiçbir zaman
 *     "kullanıcı yok" demez; kayıtsız e-posta için de satır yazar (hız sınırı
 *     için) ve token üretir (zamanlama farkını da azaltır), sadece mail atmaz.
 *  2. Ham token DB'de DURMAZ. Linkte ham token gider, DB'de SHA-256 özeti tutulur.
 *  3. Token TEK KULLANIMLIK ve süreli. Tüketilince `used_at` damgalanır; ayrıca
 *     aynı kullanıcının bekleyen DİĞER tokenları da iptal edilir.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { passwordResetTokens, users } from '@/db/schema';
import { sendEmail } from '@/lib/email/sender';
import { passwordResetEmail } from '@/lib/email/templates';
import { env } from '@/lib/env';
import { hashPassword } from '@/lib/password';

/** Token geçerlilik süresi. #46 şartı: 30 dakika standart. */
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * TTL'i kullanıcıya gösterilecek Türkçe metne çevirir ("30 dakika" / "2 saat").
 * Tek yerde durur ki mail, sayfa ve hata mesajları AYNI süreyi söylesin —
 * TTL değişince metinler otomatik uyar.
 */
export function ttlMetni(ms: number = RESET_TOKEN_TTL_MS): string {
  const dakika = Math.round(ms / 60000);
  if (dakika < 60) return `${dakika} dakika`;
  const saat = dakika / 60;
  return `${Number.isInteger(saat) ? saat : saat.toFixed(1)} saat`;
}

/** Hız sınırı: aynı e-posta için saatte en fazla bu kadar istek. */
const RATE_LIMIT_PER_EMAIL = 3;
/** Hız sınırı: aynı IP için saatte en fazla bu kadar istek. */
const RATE_LIMIT_PER_IP = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** URL-güvenli, tahmin edilemez token (32 bayt entropi). */
function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function buildResetUrl(token: string): string {
  return `${env.APP_URL.replace(/\/$/, '')}/sifre-sifirla?token=${encodeURIComponent(token)}`;
}

async function countSince(column: 'email' | 'request_ip', value: string, sinceMs: number): Promise<number> {
  const since = new Date(Date.now() - sinceMs);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(passwordResetTokens)
    .where(
      and(
        column === 'email'
          ? eq(passwordResetTokens.email, value)
          : eq(passwordResetTokens.requestIp, value),
        gt(passwordResetTokens.createdAt, since),
      ),
    );
  return row?.n ?? 0;
}

export type RequestResetOutcome =
  /** Normal yol. `emailSent` yalnız teşhis/log içindir — KULLANICIYA GÖSTERME. */
  | { ok: true; emailSent: boolean }
  /** Hız sınırı aşıldı. Kullanıcıya "biraz sonra tekrar dene" denir. */
  | { ok: false; reason: 'rate_limited' };

/**
 * Sıfırlama talebi. Kayıtlı e-posta ise mail gönderir; değilse sessizce geçer.
 * Her iki durumda da çağıran AYNI mesajı göstermelidir.
 */
export async function requestPasswordReset(params: {
  email: string;
  ip?: string | null;
}): Promise<RequestResetOutcome> {
  const email = params.email.toLowerCase().trim();
  const ip = params.ip?.trim() || null;

  const perEmail = await countSince('email', email, RATE_WINDOW_MS);
  if (perEmail >= RATE_LIMIT_PER_EMAIL) return { ok: false, reason: 'rate_limited' };
  if (ip) {
    const perIp = await countSince('request_ip', ip, RATE_WINDOW_MS);
    if (perIp >= RATE_LIMIT_PER_IP) return { ok: false, reason: 'rate_limited' };
  }

  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Kayıtsız e-posta için de token üretilir ve satır yazılır: hız sınırı çalışsın,
  // iş yükü (dolayısıyla yanıt süresi) iki durumda da benzer olsun.
  const token = generateToken();
  await db.insert(passwordResetTokens).values({
    userId: user?.id ?? null,
    email,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    requestIp: ip,
  });

  if (!user) return { ok: true, emailSent: false };

  const mail = passwordResetEmail({
    name: user.name ?? undefined,
    resetUrl: buildResetUrl(token),
    ttlMinutes: Math.round(RESET_TOKEN_TTL_MS / 60000),
  });
  const res = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
  if (!res.ok) console.error('[password-reset] mail gönderilemedi:', res.error);

  return { ok: true, emailSent: res.ok };
}

export type TokenCheck =
  | { valid: true; userId: string; email: string }
  | { valid: false; reason: 'invalid' | 'expired' | 'used' };

/** Token'ı doğrular ama TÜKETMEZ — sıfırlama formunu göstermeden önce kullanılır. */
export async function checkResetToken(token: string): Promise<TokenCheck> {
  if (!token) return { valid: false, reason: 'invalid' };

  const [row] = await db
    .select({
      userId: passwordResetTokens.userId,
      email: passwordResetTokens.email,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt: passwordResetTokens.usedAt,
      tokenHash: passwordResetTokens.tokenHash,
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, sha256(token)))
    .limit(1);

  if (!row || !row.userId) return { valid: false, reason: 'invalid' };

  // Özet eşleşmesi zaten sorguda yapıldı; burada sabit-zamanlı ikinci kontrol,
  // ileride sorgu biçimi değişirse diye savunma amaçlı duruyor.
  const a = Buffer.from(row.tokenHash);
  const b = Buffer.from(sha256(token));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false, reason: 'invalid' };

  if (row.usedAt) return { valid: false, reason: 'used' };
  if (row.expiresAt.getTime() < Date.now()) return { valid: false, reason: 'expired' };

  return { valid: true, userId: row.userId, email: row.email };
}

export type ConsumeOutcome =
  | { ok: true; email: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' };

/**
 * Token'ı tüketip şifreyi günceller.
 *
 * Yarış koşulu koruması: `used_at` güncellemesi KOŞULLU (`used_at IS NULL` +
 * süresi geçmemiş). İki istek aynı anda gelirse yalnız biri satırı damgalayabilir,
 * diğeri 0 satır günceller ve "used" alır.
 */
export async function consumeResetToken(params: {
  token: string;
  newPassword: string;
}): Promise<ConsumeOutcome> {
  const check = await checkResetToken(params.token);
  if (!check.valid) return { ok: false, reason: check.reason };

  const tokenHash = sha256(params.token);
  const claimed = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .returning({ id: passwordResetTokens.id, userId: passwordResetTokens.userId });

  if (claimed.length === 0 || !claimed[0]?.userId) return { ok: false, reason: 'used' };
  const userId = claimed[0].userId;

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(params.newPassword) })
    .where(eq(users.id, userId));

  // Aynı kullanıcının bekleyen DİĞER tokenlarını da iptal et — eski bir sıfırlama
  // maili hâlâ kutudaysa artık işe yaramasın.
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

  return { ok: true, email: check.email };
}
