/**
 * "Hoş geldin" pop-up — doğrulama, kayıt ve indirim kodu maili (Defter #974).
 *
 * ⚠️ İNDİRİM KODU GİZLİLİĞİ (talebin özü):
 * Kod İSTEMCİYE HİÇ GİTMEZ. Ne API cevabında, ne HTML'de, ne JS paketinde.
 * Yalnız burada — sunucu tarafında — `WELCOME_DISCOUNT_CODE` env'inden okunur ve
 * doğrudan mail gövdesine yazılır. Bu dosyaya kodun kendisini SABİT YAZMA.
 */
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { welcomeSignups } from '@/db/schema';
import { mailKanaliHazir, sendEmail } from '@/lib/email/sender';
import { welcomeDiscountEmail } from '@/lib/email/templates';

/** Onay kutusunun kanonik metni. Temadaki metinle BİREBİR aynı olmalı. */
export const CONSENT_TEXT =
  "Via Mood'dan kampanya ve fırsat iletileri almak istiyorum. " +
  'Kişisel verileriniz Aydınlatma Metni kapsamında işlenir.';

/** Aynı IP'den saatte en fazla bu kadar kayıt. */
const RATE_LIMIT_PER_IP = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export type SignupInput = {
  name: string;
  email: string;
  phone: string;
  consent: boolean;
  sourceUrl?: string | null;
  referrer?: string | null;
  utm?: Partial<Record<'source' | 'medium' | 'campaign' | 'term' | 'content', string>>;
  ip?: string | null;
  userAgent?: string | null;
};

export type FieldErrors = Partial<Record<'name' | 'email' | 'phone' | 'consent', string>>;

/**
 * TR telefon normalizasyonu → +90XXXXXXXXXX.
 * Kabul edilen girdiler: 05XX..., 5XX..., 905XX..., +905XX..., aralarda boşluk/tire/parantez.
 * TR cep numaraları 5 ile başlar ve 10 hanedir.
 */
export function normalizeTrPhone(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, '').replace(/^\+/, '');
  let n = d;
  if (n.startsWith('90')) n = n.slice(2);
  else if (n.startsWith('0')) n = n.slice(1);
  if (!/^5\d{9}$/.test(n)) return null;
  return `+90${n}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function validateSignup(input: SignupInput): FieldErrors {
  const errors: FieldErrors = {};

  const name = input.name?.trim() ?? '';
  if (name.length < 2) errors.name = 'Ad soyad en az 2 karakter olmalı';
  else if (name.length > 120) errors.name = 'Ad soyad çok uzun';
  else if (!/\s/.test(name)) errors.name = 'Lütfen ad ve soyadınızı yazın';

  const email = input.email?.trim().toLowerCase() ?? '';
  if (!EMAIL_RE.test(email) || email.length > 200) errors.email = 'Geçerli bir e-posta adresi girin';

  if (!normalizeTrPhone(input.phone ?? '')) {
    errors.phone = 'Geçerli bir cep telefonu girin (05XX XXX XX XX)';
  }

  // Sunucu tarafında da ZORUNLU — istemci kontrolü atlanabilir.
  if (input.consent !== true) errors.consent = 'Devam etmek için onay kutusunu işaretleyin';

  return errors;
}

async function ipCount(ip: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(welcomeSignups)
    .where(
      and(
        eq(welcomeSignups.requestIp, ip),
        gt(welcomeSignups.createdAt, new Date(Date.now() - RATE_WINDOW_MS)),
      ),
    );
  return row?.n ?? 0;
}

export type SignupResult =
  | { ok: true }
  | { ok: false; status: 400; fieldErrors: FieldErrors }
  | { ok: false; status: 429 };

/**
 * Kaydı yazar ve indirim kodu mailini gönderir.
 *
 * Mail kanalı yapılandırılmamışsa (WELCOME_DISCOUNT_CODE veya RESEND_API_KEY yok)
 * kayıt YİNE DE tutulur, `email_status='skipped'` olur ve anahtar geldiğinde
 * `scripts/welcome-mail-backfill.ts` ile geriye dönük gönderilebilir.
 * Kullanıcıya her hâlükârda aynı başarı mesajı gösterilir.
 */
export async function createSignup(input: SignupInput): Promise<SignupResult> {
  const fieldErrors = validateSignup(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, status: 400, fieldErrors };

  const ip = input.ip?.trim() || null;
  if (ip && (await ipCount(ip)) >= RATE_LIMIT_PER_IP) return { ok: false, status: 429 };

  const email = input.email.trim().toLowerCase();
  const [row] = await db
    .insert(welcomeSignups)
    .values({
      name: input.name.trim(),
      email,
      phone: input.phone.trim(),
      phoneE164: normalizeTrPhone(input.phone),
      consent: true,
      consentText: CONSENT_TEXT,
      sourceUrl: input.sourceUrl?.slice(0, 500) ?? null,
      referrer: input.referrer?.slice(0, 500) ?? null,
      utmSource: input.utm?.source?.slice(0, 200) ?? null,
      utmMedium: input.utm?.medium?.slice(0, 200) ?? null,
      utmCampaign: input.utm?.campaign?.slice(0, 200) ?? null,
      utmTerm: input.utm?.term?.slice(0, 200) ?? null,
      utmContent: input.utm?.content?.slice(0, 200) ?? null,
      requestIp: ip,
      userAgent: input.userAgent?.slice(0, 400) ?? null,
      emailStatus: 'pending',
    })
    .returning({ id: welcomeSignups.id });

  if (row) void deliverDiscountEmail(row.id, email, input.name.trim());

  return { ok: true };
}

/**
 * MAİL AKIŞININ TEK YAPILANDIRMA NOKTASI.
 *
 * Çalışması için iki koşul gerekir:
 *   WELCOME_DISCOUNT_CODE  → indirim kodu (Shopify'daki kodun aynısı), ortam değişkeni
 *   yapılandırılmış bir mail kanalı → `mailKanaliHazir()` (bkz. lib/email/sender.ts)
 * İkisi de sağlanıyorsa mail gider; biri eksikse kayıt 'skipped' olarak damgalanır.
 *
 * ⚠ KANAL KOŞULU NEDEN `mailKanaliHazir()`: burada eskiden yalnız
 * `RESEND_API_KEY` aranıyordu. Oysa sender.ts ÜÇ kademeli (Resend → SMTP →
 * stub) ve prod bugün SMTP ile gönderiyor (RESEND_API_KEY tanımlı DEĞİL).
 * Sonuç ölçüldü (22 Eyl 2026): 7 kaydın 7'si 'skipped' — çalışan bir SMTP
 * kanalı dururken tek bir hoş geldin maili çıkmamıştı. Koşul artık sendEmail'in
 * kendi yüklemleriyle AYNI yerden okunuyor, ikisi bir daha ayrışamaz.
 */
export async function deliverDiscountEmail(
  signupId: string,
  email: string,
  name: string,
): Promise<void> {
  const code = process.env.WELCOME_DISCOUNT_CODE?.trim();
  const channelReady = mailKanaliHazir();

  if (!code || !channelReady) {
    await db
      .update(welcomeSignups)
      .set({
        emailStatus: 'skipped',
        emailError: !code
          ? 'WELCOME_DISCOUNT_CODE tanımsız'
          : 'Mail kanalı tanımsız (RESEND_API_KEY ya da SMTP_USER+SMTP_PASS gerekli)',
      })
      .where(eq(welcomeSignups.id, signupId));
    return;
  }

  try {
    const mail = welcomeDiscountEmail({ name, code });
    const res = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
    await db
      .update(welcomeSignups)
      .set(
        res.ok
          ? { emailStatus: 'sent', emailSentAt: new Date(), emailError: null }
          : { emailStatus: 'failed', emailError: res.error?.slice(0, 500) ?? 'bilinmeyen hata' },
      )
      .where(eq(welcomeSignups.id, signupId));
  } catch (err) {
    await db
      .update(welcomeSignups)
      .set({
        emailStatus: 'failed',
        emailError: (err instanceof Error ? err.message : 'bilinmeyen hata').slice(0, 500),
      })
      .where(eq(welcomeSignups.id, signupId));
  }
}
