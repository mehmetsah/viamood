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
const VENDOR_PREFIXES = ['/dashboard', '/products', '/orders', '/inventory', '/payouts', '/onboarding'];

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
