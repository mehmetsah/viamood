import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth, { type DefaultSession, type NextAuthConfig } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import EmailProvider from 'next-auth/providers/nodemailer';
import Google from 'next-auth/providers/google';
import { db } from '@/db/client';
import * as schema from '@/db/schema';
import { env } from './env';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'customer' | 'vendor' | 'vendor_admin' | 'admin' | 'super_admin';
    } & DefaultSession['user'];
  }
}

const providers: Provider[] = [
  // Email + password (credentials)
  Credentials({
    name: 'Email & Password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Şifre', type: 'password' },
    },
    async authorize(credentials) {
      // TODO: Phase 1'de implement edilecek — bcrypt hash compare
      if (!credentials?.email || !credentials?.password) return null;
      return null; // placeholder
    },
  }),
];

// Optional providers — env'de ayarlandıysa eklenir
if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  );
}

if (env.RESEND_API_KEY) {
  providers.push(
    EmailProvider({
      server: {
        // Resend SMTP gateway veya transport API
        host: 'smtp.resend.com',
        port: 465,
        auth: { user: 'resend', pass: env.RESEND_API_KEY },
      },
      from: env.EMAIL_FROM,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers,
  session: { strategy: 'database' },
  pages: {
    signIn: '/auth/sign-in',
    verifyRequest: '/auth/verify',
    error: '/auth/error',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        // @ts-expect-error — role kolonu var, Auth.js default tipte yok
        session.user.role = user.role ?? 'customer';
      }
      return session;
    },
  },
});
