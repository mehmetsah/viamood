import NextAuth from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { HALKODE_PREVIEW_COOKIE, HALKODE_PREVIEW_MAX_AGE, HALKODE_TEST_ANAHTAR } from '@/lib/halkode/preview-cookie';

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set([
  '/',
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/customer-sign-up',
  '/auth/verify',
  '/auth/error',
  // Şifre sıfırlama — kullanıcı buraya giriş YAPMAMIŞ hâlde gelir.
  '/auth/sifremi-unuttum',
  '/auth/sifre-sifirla',
  // Google OAuth dönüş yolu — OTURUM ARANMAZ. Kullanıcı buraya henüz
  // giriş yapmamış hâlde döner; public olmazsa sign-in'e atılır ve
  // `code`/`state` kaybolur, giriş tamamlanamaz.
  '/auth/google/callback',
]);

const ADMIN_PREFIX = '/admin';
const VENDOR_PREFIXES = ['/dashboard', '/products', '/bundles', '/orders', '/inventory', '/payouts', '/onboarding', '/profile'];
const CUSTOMER_PREFIXES = ['/hesabim'];

// Müşteri vitrini (storefront) — herkese açık, giriş gerekmez (anonim alışveriş).
const STOREFRONT_PUBLIC_PREFIXES = ['/magaza', '/sayfa', '/sepet', '/odeme'];

/**
 * Next.js standalone server HOSTNAME env'i (örn. 127.0.0.1) ile dinler ve
 * `req.nextUrl.host`'i o şekilde populate eder — nginx Host header'ını
 * yansıtmaz. Bu fonksiyon X-Forwarded-Host > Host header > nextUrl.host
 * önceliğiyle gerçek public host'u bulur, redirect URL'lerini ona göre kurar.
 */
function buildRedirectUrl(req: NextRequest, pathname: string, params?: Record<string, string>): URL {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const rawHost = forwardedHost ?? req.headers.get('host') ?? req.nextUrl.host;
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const proto = forwardedProto ?? req.nextUrl.protocol.replace(':', '');
  const url = new URL(`${proto}://${rawHost}${pathname}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return url;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // ── Halköde 10 TL TEST SAYFASI: çerez BURADA kurulur ───────────────────────
  // Sayfa (sunucu bileşeni) çerezi KENDİSİ kuramıyor: Next "Cookies can only be
  // modified in a Server Action or Route Handler" ile 500 veriyor — ölçüldü,
  // ilk deneme canlıda tam bu hatayla düştü. Middleware çerez yazabildiği için
  // kapı buraya taşındı; böylece Yunus'a verilen link TEK parça kalıyor
  // (?halkode=1 eklemesi gerekmiyor).
  //
  // Yönlendirme YAPILMIYOR, istek olduğu gibi devam ediyor: redirect etseydik
  // 3D dönüşündeki ?sonuc=… parametreleri turlarda kaybolabilirdi.
  if (pathname.startsWith(`/odeme/halkode-test/${HALKODE_TEST_ANAHTAR}`)) {
    const res = NextResponse.next();
    if (req.cookies.get(HALKODE_PREVIEW_COOKIE)?.value !== '1') {
      res.cookies.set(HALKODE_PREVIEW_COOKIE, '1', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: HALKODE_PREVIEW_MAX_AGE,
      });
    }
    return res;
  }

  // ── Halköde gizli önizleme kapısı ──────────────────────────────────────────
  // ?halkode=1 → çerezi kur, parametresiz adrese yönlendir (Yunus'un test linki).
  // ?halkode=0 → çerezi sil (çıkış yolu).
  // Çerez YOKKEN hiçbir şey değişmez; ödeme ayarları DB'de değiştirilmez.
  // Önizleme her zaman TEST ortamına gider (bkz. lib/halkode/client.ts cfg()).
  const halkodeFlag = req.nextUrl.searchParams.get('halkode');
  if (halkodeFlag === '1' || halkodeFlag === '0') {
    const clean = buildRedirectUrl(req, pathname);
    for (const [k, v] of req.nextUrl.searchParams) {
      if (k !== 'halkode') clean.searchParams.set(k, v);
    }
    const res = NextResponse.redirect(clean);
    res.cookies.set(HALKODE_PREVIEW_COOKIE, halkodeFlag === '1' ? '1' : '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: halkodeFlag === '1' ? HALKODE_PREVIEW_MAX_AGE : 0,
    });
    return res;
  }

  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/shopify/webhooks') ||
    pathname.startsWith('/api/kargolab/webhook') || // KargoLab durum webhook'u — kendi secret'ıyla korunur
    pathname.startsWith('/api/shopify/shipping-rates') ||
    pathname.startsWith('/api/v1/tr') ||
    pathname.startsWith('/api/v1/vendor') ||
    pathname.startsWith('/api/v1/shopify') ||
    pathname.startsWith('/api/v1/payment') ||
    pathname.startsWith('/api/v1/shipping') ||
    pathname.startsWith('/api/v1/discount') ||
    pathname.startsWith('/api/v1/order-track') || // halka açık sipariş takibi (no+email doğrulamalı)
    pathname.startsWith('/api/v1/storefront') || // tema checkout köprüsü (HMAC imza doğrulamalı)
    pathname.startsWith('/api/dev') ||
    pathname.startsWith('/api/internal') || // kendi secret'ıyla korunur (webhook secret)
    pathname.startsWith('/api/cron') || // kendi secret'ıyla korunur
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // Storefront (vitrin) — anonim erişime açık
  if (STOREFRONT_PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (!session?.user) {
    return NextResponse.redirect(
      buildRedirectUrl(req, '/auth/sign-in', { callbackUrl: pathname }),
    );
  }

  const role = (session.user as { role?: string }).role;

  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.redirect(buildRedirectUrl(req, role === 'customer' ? '/hesabim' : '/dashboard'));
    }
    return NextResponse.next();
  }

  if (CUSTOMER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    // Müşteri portalı: vendor kendi paneline; admin İZİNLİ (müşteri deneyimini test edebilsin
    // — 'Hesabıma basınca admine yönleniyor' şikâyetinin düzeltmesi); customer izinli.
    if (role === 'vendor' || role === 'vendor_admin') {
      return NextResponse.redirect(buildRedirectUrl(req, '/dashboard'));
    }
    return NextResponse.next();
  }

  if (VENDOR_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    // Admin / super_admin onboarding'e takılmasın — admin paneline yönlendir
    if (
      (role === 'admin' || role === 'super_admin') &&
      (pathname === '/onboarding' || pathname.startsWith('/onboarding/'))
    ) {
      return NextResponse.redirect(buildRedirectUrl(req, '/admin'));
    }

    if (
      role !== 'vendor' &&
      role !== 'vendor_admin' &&
      role !== 'admin' &&
      role !== 'super_admin'
    ) {
      // Müşteri → kendi portalına; tanımsız rol → giriş
      return NextResponse.redirect(buildRedirectUrl(req, role === 'customer' ? '/hesabim' : '/auth/sign-in'));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Exclude: _next, all common static asset extensions (html dahil — public/access-* gibi)
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|otf|html|pdf|txt|xml|json|map|zip)).*)',
  ],
};
