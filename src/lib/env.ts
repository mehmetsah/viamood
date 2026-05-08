import { z } from 'zod';

/**
 * Zod-validated environment variables.
 * Hata veriyorsa boot'ta erken patlar (silent prod sürprizi yok).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Auth
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 chars'),
  AUTH_URL: z.string().url().default('http://localhost:3000'),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_APPLE_ID: z.string().optional(),
  AUTH_APPLE_SECRET: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Via Mood <noreply@viamood.com>'),

  // Shopify
  SHOPIFY_STORE_DOMAIN: z.string(),
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().optional(), // legacy, custom app fallback
  SHOPIFY_API_VERSION: z.string().default('2025-01'),
  SHOPIFY_WEBHOOK_SECRET: z.string().optional(),
  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  SHOPIFY_SCOPES: z.string().default('read_products,write_products,read_orders,write_orders,read_inventory,write_inventory,read_fulfillments,write_fulfillments,read_customers,read_locations'),

  // Iyzico
  IYZICO_API_KEY: z.string().optional(),
  IYZICO_SECRET_KEY: z.string().optional(),
  IYZICO_BASE_URL: z.string().url().default('https://sandbox-api.iyzipay.com'),

  // KargoLab
  KARGOLAB_API_URL: z.string().url().default('https://kargolab.com/api/v1'),
  KARGOLAB_HOST_HEADER: z.string().default('kargolab.com'),
  KARGOLAB_USER_EMAIL: z.string().email().optional(),
  KARGOLAB_USER_PASSWORD: z.string().optional(),
  KARGOLAB_MEMBER_ID: z.coerce.number().optional(),
  KARGOLAB_API_KEY: z.string().optional(), // legacy

  // Storage
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // App
  APP_NAME: z.string().default('Via Mood Vendor Platform'),
  APP_URL: z.string().url().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
export type Env = typeof env;
