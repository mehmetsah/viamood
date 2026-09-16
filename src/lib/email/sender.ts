/**
 * E-posta gönderici — üç kademeli.
 *
 *   (a) RESEND_API_KEY varsa  → Resend HTTP API
 *   (b) yoksa SMTP_USER+PASS  → nodemailer / SMTP (Gmail: 587 STARTTLS)
 *   (c) ikisi de yoksa        → stub: LOG'lar ve {ok:false} DÖNER
 *
 * ⚠️ (c) NEDEN ARTIK {ok:false}: Eskiden stub `{ok:true, id:'stub'}` dönüyordu.
 * Bu sessiz bir yalandı — çağıran taraf mail gitti sanıyordu, oysa hiçbir şey
 * gönderilmemişti. Artık sağlayıcı tanımsızsa açıkça başarısızlık döner.
 *
 * Mevcut çağrı yerleri tarandı (create-storefront-order, actions/admin,
 * actions/payout, actions/vendor, orders/lifecycle, native-create-order):
 * hiçbiri dönüş değerine göre dallanmıyor (`void sendEmail(...)` ya da sonucu
 * kullanmayan `await`), bu yüzden değişiklik mevcut akışları KIRMIYOR —
 * yalnız yeni akışlar doğru bilgi alıyor.
 */
import { env } from '../env';

export interface EmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailSonuc {
  ok: boolean;
  id?: string;
  error?: string;
  /** Hangi yol kullanıldı — teşhis/log içindir. */
  kanal?: 'resend' | 'smtp' | 'stub';
}

/** Gmail uygulama şifreleri "abcd efgh ijkl mnop" gibi BOŞLUKLU gösterilir. */
function sifreTemizle(v?: string): string {
  return (v ?? '').replace(/\s+/g, '');
}

async function resendIle(p: EmailParams): Promise<EmailSonuc> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: Array.isArray(p.to) ? p.to : [p.to],
        subject: p.subject,
        html: p.html,
        text: p.text,
        reply_to: p.replyTo,
      }),
    });
    if (!res.ok) {
      const hata = await res.text();
      console.error('[email] Resend hata:', res.status, hata);
      return { ok: false, error: `Resend ${res.status}: ${hata}`, kanal: 'resend' };
    }
    const data = (await res.json()) as { id: string };
    return { ok: true, id: data.id, kanal: 'resend' };
  } catch (err) {
    const m = err instanceof Error ? err.message : 'bilinmeyen hata';
    console.error('[email] Resend gönderim hatası:', m);
    return { ok: false, error: m, kanal: 'resend' };
  }
}

async function smtpIle(p: EmailParams): Promise<EmailSonuc> {
  try {
    // Dinamik import: nodemailer yalnız SMTP yolunda yüklensin.
    const { createTransport } = await import('nodemailer');
    const port = env.SMTP_PORT ?? 587;
    const transport = createTransport({
      host: env.SMTP_HOST ?? 'smtp.gmail.com',
      port,
      // 587 → STARTTLS (secure:false + requireTLS), 465 → doğrudan TLS
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: env.SMTP_USER!, pass: sifreTemizle(env.SMTP_PASS) },
    });

    const info = await transport.sendMail({
      from: env.EMAIL_FROM,
      to: Array.isArray(p.to) ? p.to.join(', ') : p.to,
      subject: p.subject,
      html: p.html,
      text: p.text,
      replyTo: p.replyTo,
    });

    // Sunucu adresi reddettiyse başarı sayma.
    if (info.rejected?.length) {
      return { ok: false, error: `SMTP reddetti: ${info.rejected.join(', ')}`, kanal: 'smtp' };
    }
    return { ok: true, id: info.messageId, kanal: 'smtp' };
  } catch (err) {
    const m = err instanceof Error ? err.message : 'bilinmeyen hata';
    console.error('[email] SMTP gönderim hatası:', m);
    return { ok: false, error: m, kanal: 'smtp' };
  }
}

/** (a) yolu açık mı — Resend anahtarı tanımlı mı. */
const resendVar = () => Boolean(env.RESEND_API_KEY?.trim());

/** (b) yolu açık mı — SMTP kullanıcı+şifre tanımlı mı. */
const smtpVar = () => Boolean(env.SMTP_USER?.trim() && sifreTemizle(env.SMTP_PASS));

/**
 * Yapılandırılmış bir sağlayıcı var mı — HİÇBİR ŞEY GÖNDERMEDEN söyler.
 *
 * Çağıran taraf "bu istek gönderilebilir mi" sorusunu mail denemesi YAPMADAN
 * sorabilsin diye ayrıldı: `requestPasswordReset` buna bakıp, gönderilemeyecek
 * bir bağlantı için DB'ye token yazmaktan ve kullanıcıyı oran sınırına
 * takmaktan vazgeçiyor.
 *
 * ⚠️ KOŞUL sendEmail ile AYNI İKİ YÜKLEMDEN okunur (resendVar/smtpVar). İki ayrı
 * kopya yazılsaydı biri değişip diğeri kalabilir ve "hazır" deyip gönderemeyen
 * bir hâl doğardı — burada o ayrışma yapısal olarak mümkün değil.
 */
export function mailKanaliHazir(): boolean {
  return resendVar() || smtpVar();
}

export async function sendEmail(params: EmailParams): Promise<EmailSonuc> {
  const alicilar = Array.isArray(params.to) ? params.to.join(', ') : params.to;

  if (resendVar()) return resendIle(params);

  if (smtpVar()) return smtpIle(params);

  // (c) Sağlayıcı yok — AÇIKÇA başarısız dön.
  console.error(
    `[email] Gönderilemedi (sağlayıcı tanımsız) → ${alicilar} | Konu: ${params.subject}`,
  );
  return { ok: false, error: 'mail sağlayıcı tanımsız', kanal: 'stub' };
}
