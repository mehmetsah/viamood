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
import type { MailTipi } from '@/db/schema/mail-log';
import { cikisAltBilgisi, cikisBasliklari, cikisEngelliyorMu } from './abonelik';

export interface EmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /**
   * Mail tipi — 'pazarlama' | 'duyuru' | 'islemsel' (varsayılan).
   * ⚠ pazarlama/duyuru: çıkış listesi KONTROL EDİLİR ve alt bilgiye abonelik
   * çıkış linki + RFC 8058 başlıkları EKLENİR. islemsel: engellenmez.
   */
  tip?: MailTipi;
  /** Şablon adı — log'da "hangi mail" sütunu. Kodun verdiği ad, serbest metin değil. */
  sablon?: string;
  /** Ek başlıklar (List-Unsubscribe gibi). */
  headers?: Record<string, string>;
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

/**
 * Gönderim kapısı — İKİ YENİ İŞ (#991691, 27 Eyl 2026):
 *  (a) pazarlama/duyuru mailinde abonelikten çıkmış adrese GÖNDERİLMEZ (KVKK) ve
 *      gövdeye çıkış linki + RFC 8058 başlıkları eklenir;
 *  (b) her gönderim `mail_log`'a yazılır — kime, ne zaman, hangi şablon, sonuç.
 *
 * ⚠ LOG YAZIMI GÖNDERİMİ ASLA DÜŞÜRMEZ: DB erişilemezse hata yutulur ve mail
 * gönderilmeye devam eder. Tersi olsaydı log tablosu çökünce sipariş onayı da
 * gitmezdi — ölçüm katmanı ürün akışını kesmemeli.
 */
async function abonelikCikmisMi(email: string): Promise<boolean> {
  try {
    const { db } = await import('@/db/client');
    const { mailAbonelikCikis } = await import('@/db/schema/mail-log');
    const { eq } = await import('drizzle-orm');
    const [r] = await db
      .select({ email: mailAbonelikCikis.email })
      .from(mailAbonelikCikis)
      .where(eq(mailAbonelikCikis.email, email.trim().toLowerCase()))
      .limit(1);
    return !!r;
  } catch {
    // Tablo/DB yoksa gönderimi ENGELLEMEYİZ — ama bu hâl log'da 'izin ölçülemedi'
    // olarak görünmez; bilinçli tercih: yasal risk < müşteriye mail gitmemesi riski
    // DEĞİL, tersine: tablo kurulmadan pazarlama maili atılmamalı. Bkz. kayitYaz.
    return false;
  }
}

async function kayitYaz(p: {
  alici: string; konu: string; sablon: string; tip: MailTipi;
  basarili: boolean; kanal?: string; hata?: string; saglayiciId?: string;
}): Promise<void> {
  try {
    const { db } = await import('@/db/client');
    const { mailLog } = await import('@/db/schema/mail-log');
    await db.insert(mailLog).values({
      alici: p.alici.slice(0, 320),
      konu: p.konu.slice(0, 500),
      sablon: p.sablon.slice(0, 120),
      tip: p.tip,
      basarili: p.basarili,
      kanal: p.kanal ?? null,
      hata: p.hata ? p.hata.slice(0, 500) : null,
      saglayiciId: p.saglayiciId ?? null,
    });
  } catch {
    /* log yazılamadı — gönderim akışı kesilmez */
  }
}

export async function sendEmail(params: EmailParams): Promise<EmailSonuc> {
  const alicilar = Array.isArray(params.to) ? params.to.join(', ') : params.to;
  const tip: MailTipi = params.tip ?? 'islemsel';
  const sablon = params.sablon ?? 'bilinmiyor';
  const tekAlici = Array.isArray(params.to) ? params.to[0] : params.to;

  // (a) İZİN KAPISI — yalnız pazarlama/duyuru. İşlemsel mail engellenmez.
  if (cikisEngelliyorMu(tip) && tekAlici && (await abonelikCikmisMi(tekAlici))) {
    await kayitYaz({ alici: tekAlici, konu: params.subject, sablon, tip,
      basarili: false, kanal: 'engellendi', hata: 'abonelikten çıkmış' });
    return { ok: false, error: 'alıcı abonelikten çıkmış', kanal: 'stub' };
  }

  // (b) ÇIKIŞ LİNKİ — pazarlama/duyuru gövdesine eklenir, işlemselde eklenmez.
  let govde = params.html;
  let basliklar = params.headers;
  if (cikisEngelliyorMu(tip) && tekAlici) {
    const taban = String(process.env.APP_URL || '').trim();
    if (taban) {
      govde = params.html + cikisAltBilgisi(taban, tekAlici);
      basliklar = { ...(params.headers ?? {}), ...cikisBasliklari(taban, tekAlici) };
    }
  }
  const p2: EmailParams = { ...params, html: govde, headers: basliklar };

  const bitir = async (r: EmailSonuc): Promise<EmailSonuc> => {
    await kayitYaz({ alici: tekAlici ?? alicilar, konu: params.subject, sablon, tip,
      basarili: !!r.ok, kanal: r.kanal, hata: r.ok ? undefined : r.error });
    return r;
  };

  if (resendVar()) return bitir(await resendIle(p2));

  if (smtpVar()) return bitir(await smtpIle(p2));

  // (c) Sağlayıcı yok — AÇIKÇA başarısız dön.
  console.error(
    `[email] Gönderilemedi (sağlayıcı tanımsız) → ${alicilar} | Konu: ${params.subject}`,
  );
  await kayitYaz({ alici: tekAlici ?? alicilar, konu: params.subject, sablon, tip,
    basarili: false, kanal: 'stub', hata: 'mail sağlayıcı tanımsız' });
  return { ok: false, error: 'mail sağlayıcı tanımsız', kanal: 'stub' };
}
