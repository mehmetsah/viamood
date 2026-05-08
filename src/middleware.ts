import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
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
const VENDOR_PREFIXES = ['/dashboard', '/products', '/orders', '/inventory', '/payouts', '/onboarding', '/profile'];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (!session?.user) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth/sign-in';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // role JWT token'da geliyor (auth.ts'deki jwt callback'inden)
  const role = (session.user as { role?: string }).role;

  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (role !== 'admin' && role !== 'super_admin') {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (VENDOR_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    // Admin / super_admin onboarding'e takılmasın — admin paneline yönlendir
    if (
      (role === 'admin' || role === 'super_admin') &&
      (pathname === '/onboarding' || pathname.startsWith('/onboarding/'))
    ) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }

    if (
      role !== 'vendor' &&
      role !== 'vendor_admin' &&
      role !== 'admin' &&
      role !== 'super_admin'
    ) {
      const url = req.nextUrl.clone();
      url.pathname = '/auth/sign-in';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Exclude: _next, all common static asset extensions
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|otf)).*)',
  ],
};
