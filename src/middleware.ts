import NextAuth from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set([
  '/',
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/verify',
  '/auth/error',
]);

const ADMIN_PREFIX = '/admin';
const VENDOR_PREFIXES = ['/dashboard', '/products', '/bundles', '/orders', '/inventory', '/payouts', '/onboarding', '/profile'];

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

  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/shopify/webhooks') ||
    pathname.startsWith('/api/shopify/shipping-rates') ||
    pathname.startsWith('/api/v1/vendor') ||
    pathname.startsWith('/api/dev') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (!session?.user) {
    return NextResponse.redirect(
      buildRedirectUrl(req, '/auth/sign-in', { callbackUrl: pathname }),
    );
  }

  const role = (session.user as { role?: string }).role;

  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (role !== 'admin' && role !== 'super_admin') {
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
      return NextResponse.redirect(buildRedirectUrl(req, '/auth/sign-in'));
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
