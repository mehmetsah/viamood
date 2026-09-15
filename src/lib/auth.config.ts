/**
 * Edge-safe auth config — middleware'da kullanılır.
 * `authorize` fonksiyonu YOK çünkü bcrypt Edge'de çalışmaz.
 * Tam config (auth.ts) bu config'i extend eder + Credentials authorize ekler.
 */
import type { NextAuthConfig } from 'next-auth';

/**
 * Edge config'te SOSYAL PROVIDER YOK — bilinçli.
 *
 * Kimlikler artık DB'den okunuyor (store_settings.auth) ve DB/bcrypt EDGE'de
 * çalışmaz. Middleware'in tek işi oturum var mı diye bakmak; provider listesine
 * ihtiyacı yok. Google provider'ı node tarafında (auth.ts) tembel eklenir.
 */
const providers: NextAuthConfig['providers'] = [];

export const authConfig: NextAuthConfig = {
  providers,
  /**
   * PROD'DA AUTH_URL YANLIŞ: /api/auth/providers "https://localhost:4001/..."
   * döndürüyordu → OAuth callback'i localhost'a kaçıyor, giriş çalışmıyordu.
   * Sunucuya SSH kapalı olduğu için .env düzeltilemiyor; host'u GELEN İSTEKTEN
   * türetiyoruz. nginx X-Forwarded-Host gönderiyor (middleware de onu okuyor).
   */
  trustHost: true,
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
        // Şifre sıfırlama — kullanıcı buraya giriş YAPMAMIŞ hâlde gelir.
        '/auth/sifremi-unuttum',
        '/auth/sifre-sifirla',
        // Google OAuth dönüş yolu — OTURUM ARANMAZ. Kullanıcı buraya henüz
        // giriş yapmamış hâlde döner; public olmazsa sign-in'e atılır ve
        // `code`/`state` kaybolur, giriş tamamlanamaz.
        '/auth/google/callback',
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
