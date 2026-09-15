/**
 * Tam auth config — server actions / API routes'ta kullanılır.
 * Bcrypt + DB query içerir, Edge runtime'da çalışmaz.
 * Middleware için auth.config.ts kullanılır.
 */
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import NextAuth, { type DefaultSession, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { db } from '@/db/client';
import * as schema from '@/db/schema';
import { authConfig } from './auth.config';
import { getGoogleCreds } from './auth/social';
import { verifyPassword } from './password';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'customer' | 'vendor' | 'vendor_admin' | 'admin' | 'super_admin';
    } & DefaultSession['user'];
  }
}

/**
 * TEMBEL CONFIG: NextAuth v5 config'i fonksiyon olarak kabul eder ve her
 * istekte çağırır. Google kimlikleri DB'den geldiği için provider listesini
 * istek anında kuruyoruz — panelden kimlik girilince YENİDEN DEPLOY GEREKMEZ.
 * (Sunucuya SSH kapalı olduğundan .env yolu zaten kapalı.)
 */
export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const google = await getGoogleCreds();
  return {
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: [
    ...authConfig.providers,
    ...(google
      ? [
          Google({
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Şifre', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .limit(1);
        if (!user || !user.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /**
     * HESAP EŞLEME KURALI (test ile çivilendi):
     *  · Google'dan gelen e-posta ZATEN KAYITLIYSA aynı hesaba bağlanır —
     *    yinelenen üye AÇILMAZ (allowDangerousEmailAccountLinking + burada
     *    e-posta doğrulanmış sayılır).
     *  · Doğrulanmamış Google e-postası REDDEDİLİR (hesap ele geçirme yolu).
     *  · Rol asla yükseltilmez; yeni kayıt daima 'customer'. Google ile gelen
     *    hiç kimse admin olamaz.
     */
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;
      if (profile && profile.email_verified === false) return false;
      const email = (profile?.email ?? '').toLowerCase().trim();
      if (!email) return false;

      const [mevcut] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (mevcut) {
        // Var olan hesaba bağlanıyor: e-postayı doğrulanmış işaretle, ROLE DOKUNMA.
        await db
          .update(schema.users)
          .set({ emailVerified: new Date() })
          .where(eq(schema.users.id, mevcut.id));
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.userId = user.id;
        const [u] = await db
          .select({ role: schema.users.role })
          .from(schema.users)
          .where(eq(schema.users.id, user.id))
          .limit(1);
        token.role = u?.role ?? 'customer';
      }

      if (trigger === 'update' && token.userId) {
        const [u] = await db
          .select({ role: schema.users.role })
          .from(schema.users)
          .where(eq(schema.users.id, token.userId as string))
          .limit(1);
        if (u) token.role = u.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) ?? session.user.id;
        // @ts-expect-error — role kolonu var, default tipte yok
        session.user.role = (token.role as string) ?? 'customer';
      }
      return session;
    },
  },
  } satisfies NextAuthConfig;
});
