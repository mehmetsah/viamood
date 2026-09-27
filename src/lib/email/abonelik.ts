/**
 * ABONELİKTEN ÇIKMA — jeton üretimi, doğrulama ve mail alt bilgisi. SAF mantık.
 *
 * NEDEN JETON (ve neden düz e-posta değil): link `?email=x@y.com` taşırsa herkes
 * BAŞKASININ adresini listeden düşürebilir — tek tık ile sabotaj. Bu yüzden link
 * `e` (base64url e-posta) + `s` (HMAC-SHA256 imza) taşır; imza tutmayan istek
 * reddedilir. Aynı sır e-postayı ŞİFRELEMEZ, yalnız kurcalanmadığını kanıtlar.
 *
 * ⚠ TEK TIK KURALI: Meta/Gmail "List-Unsubscribe-Post" bekler ve tek tıkla
 * çıkışı şart koşar; onay sayfasına ikinci tık koymak spam puanını yükseltir.
 * O yüzden GET de POST da aynı işi yapar ve idempotenttir (ikinci tık hata vermez).
 *
 * ⚠ HANGİ MAİLDE ZORUNLU: `pazarlama` ve `duyuru`. `islemsel` maillerde (sipariş
 * onayı, kargo, şifre sıfırlama) yasal zorunluluk YOK ve çıkış listesi bu tipi
 * ENGELLEMEZ — engellerse müşteri kendi siparişinin bilgisini alamaz.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MailTipi } from '@/db/schema/mail-log';

/** Çıkış linkinin ZORUNLU olduğu tipler. */
export const CIKIS_ZORUNLU_TIPLER: readonly MailTipi[] = ['pazarlama', 'duyuru'];

export function cikisZorunluMu(tip: MailTipi): boolean {
  return CIKIS_ZORUNLU_TIPLER.includes(tip);
}

/** Çıkış listesi bu tipi engelliyor mu (işlemsel mail ASLA engellenmez). */
export function cikisEngelliyorMu(tip: MailTipi): boolean {
  return cikisZorunluMu(tip);
}

function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}
function b64urlCoz(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8');
}

/**
 * İmza sırrı. AUTH_SECRET'a bağlı — ayrı bir sır daha üretip yönetmemek için.
 * ⚠ Sır YOKSA boş dize döner ve `jetonDogrula` her şeyi REDDEDER: imzasız çalışan
 * bir çıkış ucu, herkesin herkesi listeden düşürebildiği bir uçtur.
 */
function sir(): string {
  return String(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '').trim();
}

export function imzala(email: string): string {
  const s = sir();
  if (!s) return '';
  return createHmac('sha256', s).update(email.trim().toLowerCase(), 'utf8').digest('base64url');
}

/** Link sorgu dizesi: `e=<base64url>&s=<imza>`. */
export function cikisSorgusu(email: string): string {
  const e = email.trim().toLowerCase();
  return 'e=' + b64url(e) + '&s=' + imzala(e);
}

export function cikisLinki(tabanUrl: string, email: string): string {
  const taban = String(tabanUrl || '').replace(/\/+$/, '');
  return taban + '/api/email/abonelik-cik?' + cikisSorgusu(email);
}

/**
 * Jetonu çözer ve imzayı doğrular. Geçersizse null.
 * Karşılaştırma `timingSafeEqual` ile — imza uzunluğunu sızdıran erken çıkış yok.
 */
export function jetonDogrula(e?: string | null, s?: string | null): string | null {
  if (!e || !s || !sir()) return null;
  let email = '';
  try {
    email = b64urlCoz(String(e)).trim().toLowerCase();
  } catch {
    return null;
  }
  if (!email || !email.includes('@')) return null;
  const beklenen = imzala(email);
  if (!beklenen) return null;
  const a = Buffer.from(beklenen, 'utf8');
  const b = Buffer.from(String(s), 'utf8');
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? email : null;
}

/**
 * Mail gövdesine eklenecek alt bilgi. Yeni tasarım dili ÜRETİLMEZ: mevcut
 * şablonların alt bilgisiyle aynı inline stil dili (12px, soluk gri, ortalı).
 */
export function cikisAltBilgisi(tabanUrl: string, email: string): string {
  const link = cikisLinki(tabanUrl, email);
  return (
    '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;' +
    'font-size:12px;line-height:1.6;color:#737373;text-align:center">' +
    'Bu e-postayı Via Mood’dan aldınız.<br>' +
    '<a href="' + link + '" style="color:#737373;text-decoration:underline">' +
    'Abonelikten çık — bu tür e-postaları almak istemiyorum</a>' +
    '</div>'
  );
}

/** Gmail/Outlook tek-tık çıkış başlıkları (RFC 8058). */
export function cikisBasliklari(tabanUrl: string, email: string): Record<string, string> {
  const link = cikisLinki(tabanUrl, email);
  return {
    'List-Unsubscribe': '<' + link + '>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
