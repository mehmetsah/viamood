/**
 * "Şifremi unuttum" servis katmanı.
 *
 * Güvenlik değişmezleri (bunları bozma):
 *  1. HESAP VARLIĞI SIZMAZ. Kayıtlı olsun olmasın çağıran AYNI sonucu alır;
 *     kayıtsız e-posta için de satır yazılır (oran sınırı çalışsın, zamanlama
 *     farkı azalsın) ama mail gitmez.
 *  2. Ham token DB'de DURMAZ — linkte ham, DB'de SHA-256 özeti.
 *  3. Token TEK KULLANIMLIK ve 60 dk süreli. Tüketilince `usedAt` damgalanır;
 *     aynı kullanıcının bekleyen diğer tokenları da iptal edilir.
 *  4. Oran sınırı: aynı e-posta için 5 dakikada 1 istek.
 */
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { passwordResetTokens, sessions, users } from '@/db/schema';
import { sendEmail } from '@/lib/email/sender';
import { passwordResetEmail } from '@/lib/email/templates';
import { env } from '@/lib/env';
import { hashPassword } from '@/lib/password';

/** Token geçerlilik süresi — 60 dakika. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Oran sınırı: aynı e-posta için bu pencerede en fazla 1 istek. */
const ORAN_PENCERE_MS = 5 * 60 * 1000;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export function buildResetUrl(token: string): string {
  return `${env.APP_URL.replace(/\/$/, '')}/auth/sifre-sifirla?token=${encodeURIComponent(token)}`;
}

export type TalepSonuc =
  /** `mailGitti` yalnız TEŞHİS içindir — kullanıcıya gösterme, sızdırır. */
  | { ok: true; mailGitti: boolean; mailHatasi?: string }
  | { ok: false; sebep: 'oran_siniri' };

export async function requestPasswordReset(params: {
  email: string;
  ip?: string | null;
}): Promise<TalepSonuc> {
  const email = params.email.toLowerCase().trim();
  const ip = params.ip?.trim() || null;

  // ── Oran sınırı: 5 dakikada 1 ──────────────────────────────────────────
  const [sayim] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.email, email),
        gt(passwordResetTokens.createdAt, new Date(Date.now() - ORAN_PENCERE_MS)),
      ),
    );
  if ((sayim?.n ?? 0) >= 1) return { ok: false, sebep: 'oran_siniri' };

  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Kayıtsız e-posta için de token üretilir ve satır yazılır (bkz. değişmez 1).
  const token = randomBytes(32).toString('base64url');
  await db.insert(passwordResetTokens).values({
    userId: user?.id ?? null,
    email,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    requestIp: ip,
  });

  if (!user) return { ok: true, mailGitti: false };

  const mail = passwordResetEmail({
    name: user.name ?? undefined,
    resetUrl: buildResetUrl(token),
    dakika: Math.round(RESET_TOKEN_TTL_MS / 60000),
  });
  const res = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
  // Teşhis: kanal + sağlayıcı mesaj kimliği. TOKEN ve ADRES GÖVDESİ LOG'LANMAZ.
  if (res.ok) console.info(`[sifre-sifirlama] gönderildi · kanal=${res.kanal} id=${res.id}`);
  else console.error(`[sifre-sifirlama] GÖNDERİLEMEDİ · kanal=${res.kanal} hata=${res.error}`);

  return { ok: true, mailGitti: res.ok, mailHatasi: res.ok ? undefined : res.error };
}

export type TokenKontrol =
  | { gecerli: true; userId: string; email: string }
  | { gecerli: false; sebep: 'gecersiz' | 'suresi_doldu' | 'kullanilmis' };

/** Token'ı doğrular ama TÜKETMEZ — formu göstermeden önce kullanılır. */
export async function checkResetToken(token: string): Promise<TokenKontrol> {
  if (!token) return { gecerli: false, sebep: 'gecersiz' };

  const [row] = await db
    .select({
      userId: passwordResetTokens.userId,
      email: passwordResetTokens.email,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt: passwordResetTokens.usedAt,
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, sha256(token)))
    .limit(1);

  if (!row || !row.userId) return { gecerli: false, sebep: 'gecersiz' };
  if (row.usedAt) return { gecerli: false, sebep: 'kullanilmis' };
  if (row.expiresAt.getTime() < Date.now()) return { gecerli: false, sebep: 'suresi_doldu' };
  return { gecerli: true, userId: row.userId, email: row.email };
}

export type TuketSonuc =
  | { ok: true; email: string }
  | { ok: false; sebep: 'gecersiz' | 'suresi_doldu' | 'kullanilmis' };

/**
 * Token'ı tüketip şifreyi günceller.
 *
 * Yarış koşulu koruması: `usedAt` güncellemesi KOŞULLU (`used_at IS NULL` +
 * süresi geçmemiş). İki istek aynı anda gelirse yalnız biri damgalayabilir.
 */
export async function consumeResetToken(params: {
  token: string;
  newPassword: string;
}): Promise<TuketSonuc> {
  const kontrol = await checkResetToken(params.token);
  if (!kontrol.gecerli) return { ok: false, sebep: kontrol.sebep };

  const tokenHash = sha256(params.token);
  const alinan = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: passwordResetTokens.userId });

  const userId = alinan[0]?.userId;
  if (!userId) return { ok: false, sebep: 'kullanilmis' };

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(params.newPassword) })
    .where(eq(users.id, userId));

  // Bekleyen DİĞER tokenları iptal et — eski bir mail hâlâ kutudaysa işe yaramasın.
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

  // Açık oturumları düşür: şifre değişince eski oturumlar geçersiz olmalı.
  // (JWT stratejisinde tablo boş olabilir; yine de temizliyoruz.)
  await db.delete(sessions).where(eq(sessions.userId, userId));

  return { ok: true, email: kontrol.email };
}
