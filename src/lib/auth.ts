/**
 * Tam auth config — server actions / API routes'ta kullanılır.
 * Bcrypt + DB query içerir, Edge runtime'da çalışmaz.
 * Middleware için auth.config.ts kullanılır.
 */
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import NextAuth, { type DefaultSession, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/db/client';
import * as schema from '@/db/schema';
import { authConfig } from './auth.config';
import { verifyPassword } from './password';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'customer' | 'vendor' | 'vendor_admin' | 'admin' | 'super_admin';
    } & DefaultSession['user'];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: [
    ...authConfig.providers,
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
} satisfies NextAuthConfig);
