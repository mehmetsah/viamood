/**
 * Edge-safe auth config — middleware'da kullanılır.
 * `authorize` fonksiyonu YOK çünkü bcrypt Edge'de çalışmaz.
 * Tam config (auth.ts) bu config'i extend eder + Credentials authorize ekler.
 */
import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import { env } from './env';

const providers: NextAuthConfig['providers'] = [];

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  );
}

export const authConfig: NextAuthConfig = {
  providers,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 }, // 7 gün
  pages: {
    signIn: '/auth/sign-in',
    verifyRequest: '/auth/verify',
    error: '/auth/error',
  },
  callbacks: {
    // Edge-safe — DB query yok
    authorized({ auth, request }) {
      const session = auth;
      const { pathname } = request.nextUrl;

      const PUBLIC_PATHS = new Set([
        '/',
        '/auth/sign-in',
        '/auth/sign-up',
        '/auth/verify',
        '/auth/error',
      ]);
      if (PUBLIC_PATHS.has(pathname)) return true;
      if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/health')) return true;

      return !!session?.user;
    },
    // Token'daki userId + role'u session.user'a kopyala (middleware için şart)
    async session({ session, token }) {
      if (session.user) {
        if (token.userId) session.user.id = token.userId as string;
        // @ts-expect-error — role custom alan
        session.user.role = (token.role as string) ?? 'customer';
      }
      return session;
    },
  },
};
