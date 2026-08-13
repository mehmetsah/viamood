-- 0018_tenants — Tenant registry (multi-instance kontrol düzlemi, /admin/tenants paneli).
-- İdempotent: deploy hattı numaralı SQL'leri her deploy'da koşabildiği için IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS "tenants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "storefront_url" text NOT NULL,
  "app_url" text,
  "shopify_domain" text,
  "db_name" text,
  "status" text DEFAULT 'provisioning' NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
CREATE INDEX IF NOT EXISTS "tenants_status_idx" ON "tenants" ("status");

-- Ana instance'ın kendisi de kayıtlı olsun (idempotent seed)
INSERT INTO "tenants" ("name", "slug", "storefront_url", "app_url", "shopify_domain", "db_name", "status", "notes")
SELECT 'Via Mood', 'viamood', 'https://viamood.com.tr', 'http://13.62.159.252', 'd3z34m-iw.myshopify.com', 'viamood', 'active', 'Ana (kontrol) instance — bu panelin kendisi'
WHERE NOT EXISTS (SELECT 1 FROM "tenants" WHERE "slug" = 'viamood');
