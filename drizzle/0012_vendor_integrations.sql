-- FAZ 2 — vendor_integrations (pazaryeri kredensiyel deposu, şifreli)
-- ELLE yazılmış idempotent migration (db:generate 0005'ten beri kırık; manuel psql ile uygulanır).
-- Güvenli tekrar çalıştırılabilir: IF NOT EXISTS + DO blokları.

DO $$ BEGIN
  CREATE TYPE "integration_provider" AS ENUM ('trendyol');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "integration_status" AS ENUM ('disconnected', 'connected', 'error');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "vendor_integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vendor_id" uuid NOT NULL,
  "provider" "integration_provider" NOT NULL,
  "external_supplier_id" text NOT NULL,
  "credential_enc" text NOT NULL,
  "status" "integration_status" DEFAULT 'disconnected' NOT NULL,
  "last_tested_at" timestamptz,
  "last_error" text,
  "last_sync_at" timestamptz,
  "product_count" integer,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "vendor_integrations"
    ADD CONSTRAINT "vendor_integrations_vendor_id_vendors_id_fk"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "vendor_integrations"
    ADD CONSTRAINT "vendor_integrations_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "vendor_integrations"
    ADD CONSTRAINT "vendor_integrations_vendor_provider_uq" UNIQUE ("vendor_id", "provider");
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "vendor_integrations_vendor_idx" ON "vendor_integrations" ("vendor_id");
