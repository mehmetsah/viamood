-- FAZ 3.3 — Hibrit toplama turu (pickup_runs + pickup_run_stops) + kalem durum değerleri.
-- ELLE idempotent migration (db:generate 0005'ten beri kırık; manuel psql ile uygulanır).
-- NOT: ALTER TYPE ADD VALUE'ları önce ve TEK BAŞINA çalıştır (aynı işlemde yeni değer kullanılamaz).

-- 1) order_line_item_status enum'una hibrit toplama değerleri
ALTER TYPE "order_line_item_status" ADD VALUE IF NOT EXISTS 'collected' AFTER 'awaiting_pickup';
ALTER TYPE "order_line_item_status" ADD VALUE IF NOT EXISTS 'received' AFTER 'collected';

-- 2) Yeni enum'lar
DO $$ BEGIN
  CREATE TYPE "pickup_run_status" AS ENUM ('planned', 'collecting', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "pickup_stop_status" AS ENUM ('pending', 'collected', 'received', 'skipped');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3) pickup_runs
CREATE TABLE IF NOT EXISTS "pickup_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_date" date NOT NULL,
  "status" "pickup_run_status" DEFAULT 'planned' NOT NULL,
  "stop_count" integer DEFAULT 0 NOT NULL,
  "item_count" integer DEFAULT 0 NOT NULL,
  "total_quantity" integer DEFAULT 0 NOT NULL,
  "note" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "pickup_runs" ADD CONSTRAINT "pickup_runs_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "pickup_runs_date_idx" ON "pickup_runs" ("run_date");
CREATE INDEX IF NOT EXISTS "pickup_runs_status_idx" ON "pickup_runs" ("status");

-- 4) pickup_run_stops
CREATE TABLE IF NOT EXISTS "pickup_run_stops" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pickup_run_id" uuid NOT NULL,
  "seq" integer NOT NULL,
  "vendor_id" uuid NOT NULL,
  "vendor_name" text NOT NULL,
  "city" text,
  "district" text,
  "item_count" integer DEFAULT 0 NOT NULL,
  "total_quantity" integer DEFAULT 0 NOT NULL,
  "line_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" "pickup_stop_status" DEFAULT 'pending' NOT NULL,
  "collected_at" timestamptz,
  "collected_by" uuid,
  "received_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "pickup_run_stops" ADD CONSTRAINT "pickup_run_stops_pickup_run_id_fk"
    FOREIGN KEY ("pickup_run_id") REFERENCES "pickup_runs"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "pickup_run_stops" ADD CONSTRAINT "pickup_run_stops_vendor_id_fk"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "pickup_run_stops" ADD CONSTRAINT "pickup_run_stops_collected_by_users_id_fk"
    FOREIGN KEY ("collected_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "pickup_run_stops" ADD CONSTRAINT "pickup_run_stops_run_vendor_uq"
    UNIQUE ("pickup_run_id", "vendor_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "pickup_run_stops_run_idx" ON "pickup_run_stops" ("pickup_run_id");
