import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// In production / Vercel, reuse the connection across function invocations.
// In dev, persist client on globalThis to avoid hot-reload exhausting connections.
declare global {
  // eslint-disable-next-line no-var
  var __dbClient: ReturnType<typeof postgres> | undefined;
}

const client =
  globalThis.__dbClient ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Required for transaction pooler (Supabase)
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__dbClient = client;
}

export const db = drizzle(client, { schema, logger: process.env.NODE_ENV === 'development' });

export type DB = typeof db;
export { schema };
