/**
 * /api/email/abonelik-cik — "bu tür e-postaları almak istemiyorum" ucu (#991691).
 *
 * TEK TIK, İKİ YÖNTEM: GET (kullanıcı linke tıklar) ve POST (Gmail/Outlook
 * RFC 8058 `List-Unsubscribe-Post: One-Click`) AYNI işi yapar. Onay sayfasına
 * ikinci tık konmadı — hem spam puanını yükseltir hem RFC'yi ihlal eder.
 *
 * GÜVENLİK: link düz e-posta taşımaz; `e` (base64url) + `s` (HMAC) taşır ve imza
 * doğrulanmadan HİÇBİR kayıt yazılmaz. Yoksa herkes başkasının adresini tek tıkla
 * listeden düşürebilirdi.
 *
 * İDEMPOTENT: aynı adres ikinci kez tıklarsa hata değil, yine "çıkarıldı" döner
 * (`onConflictDoNothing`) — kullanıcı linke iki kez basınca hata ekranı görmemeli.
 */
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { mailAbonelikCikis } from '@/db/schema/mail-log';
import { jetonDogrula } from '@/lib/email/abonelik';

export const dynamic = 'force-dynamic';

const BASLIK = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };

/** Yeni tasarım dili üretilmez — sade, markasız, tek cümlelik onay sayfası. */
function sayfa(baslik: string, mesaj: string, kod: number): NextResponse {
  const html =
    '<!doctype html><html lang="tr"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex"><title>' + baslik + '</title></head>' +
    '<body style="margin:0;padding:48px 20px;background:#fafafa;font:15px/1.6 system-ui,sans-serif;color:#171717">' +
    '<div style="max-width:32rem;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:28px">' +
    '<h1 style="margin:0 0 12px;font-size:18px;line-height:1.4">' + baslik + '</h1>' +
    '<p style="margin:0;line-height:1.6;color:#525252">' + mesaj + '</p></div></body></html>';
  return new NextResponse(html, { status: kod, headers: BASLIK });
}

async function cikar(email: string): Promise<boolean> {
  try {
    await db
      .insert(mailAbonelikCikis)
      .values({ email, kapsam: 'hepsi', kaynak: 'link' })
      .onConflictDoNothing();
    return true;
  } catch (e) {
    console.error('[abonelik-cik] yazılamadı', { sinif: (e as Error)?.name });
    return false;
  }
}

async function isle(e: string | null, s: string | null): Promise<NextResponse> {
  const email = jetonDogrula(e, s);
  if (!email) {
    // Hangi parçanın bozuk olduğunu SÖYLEMEYİZ — imza denemesine ipucu vermez.
    return sayfa('Bağlantı geçerli değil', 'Bu bağlantı geçersiz ya da süresi geçmiş. Mailin içindeki bağlantıyı yeniden deneyin.', 400);
  }
  const ok = await cikar(email);
  if (!ok) return sayfa('Şu an kaydedemedik', 'Teknik bir sorun oldu. Birazdan tekrar deneyin ya da bize yazın.', 500);
  return sayfa(
    'Çıkarıldınız',
    'Bundan sonra pazarlama ve duyuru e-postalarımızı almayacaksınız. Sipariş ve kargo bilgilendirmeleri, kendi işleminizin sonucu olduğu için gönderilmeye devam eder.',
    200,
  );
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  return isle(u.searchParams.get('e'), u.searchParams.get('s'));
}

/** RFC 8058 tek-tık: gövde yok, sorgu dizesi aynı. */
export async function POST(req: Request) {
  const u = new URL(req.url);
  return isle(u.searchParams.get('e'), u.searchParams.get('s'));
}
