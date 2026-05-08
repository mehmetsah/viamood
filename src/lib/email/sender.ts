/**
 * Email sender — Resend ile gönderir, RESEND_API_KEY yoksa console'a logger.
 * Best-effort: hata durumunda main işlem yine de geçer.
 */
import { env } from '../env';

export interface EmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(params: EmailParams): Promise<{ ok: boolean; id?: string; error?: string }> {
  const recipients = Array.isArray(params.to) ? params.to.join(', ') : params.to;

  if (!env.RESEND_API_KEY) {
    console.log(`📧 [stub] Email to ${recipients} | Subject: ${params.subject}`);
    if (process.env.NODE_ENV === 'development') {
      console.log(`   Body preview: ${params.text?.slice(0, 200) ?? '(html only)'}`);
    }
    return { ok: true, id: 'stub' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        reply_to: params.replyTo,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('[email] Resend hata:', res.status, error);
      return { ok: false, error: `Resend ${res.status}: ${error}` };
    }
    const data = (await res.json()) as { id: string };
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('[email] gönderim hatası:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}
