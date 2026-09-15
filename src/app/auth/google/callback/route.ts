/**
 * Google Console uyum köprüsü.
 *
 * Yunus'un Google Cloud projesinde (via-global-508511) kayıtlı redirect URI:
 *     https://hesap.viamood.com.tr/auth/google/callback
 * NextAuth'un beklediği yol ise:
 *     https://hesap.viamood.com.tr/api/auth/callback/google
 *
 * İkisi EŞLEŞMİYOR. Console'da değişiklik beklemeden giriş çalışsın diye
 * bu uç, gelen isteği NextAuth'un ucuna yönlendirir.
 *
 * QUERY STRING BİREBİR KORUNUR — `code` ve `state` kaybolursa OAuth akışı
 * kırılır (state kaybı = CSRF doğrulaması başarısız). `scope`, `authuser`,
 * `prompt`, `error` gibi alanlar da aynen taşınır.
 *
 * 307 kullanılır: yöntem ve gövde korunur (Google GET gönderir ama 302'nin
 * yöntem değiştirme riski yok sayılmasın).
 */
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * nginx arkasında `req.nextUrl.host` gerçek public host'u yansıtmayabilir
 * (standalone server HOSTNAME ile dinler). Middleware'deki buildRedirectUrl
 * ile AYNI öncelik: X-Forwarded-Host > Host > nextUrl.host.
 */
function publicHost(req: NextRequest): { proto: string; host: string } {
  const host =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  const proto =
    req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');
  return { proto, host };
}

export function GET(req: NextRequest): NextResponse {
  const { proto, host } = publicHost(req);
  const hedef = new URL(`${proto}://${host}/api/auth/callback/google`);
  // Tüm parametreler aynen taşınır (code, state, scope, authuser, prompt, error…)
  req.nextUrl.searchParams.forEach((v, k) => hedef.searchParams.set(k, v));
  return NextResponse.redirect(hedef, 307);
}
