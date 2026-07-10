-- Müşteri iade talepleri (portal /hesabim/iadeler + admin işleme). Elle yazıldı, idempotent.

CREATE TABLE IF NOT EXISTS "returns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid,
  "customer_id" uuid NOT NULL,
  "order_name" text,
  "return_code" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'awaiting_shipment',
  "reason" text,
  "refund_amount_cents" bigint NOT NULL DEFAULT 0,
  "carrier" text,
  "tracking_number" text,
  "line_items" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_fk"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "returns_customer_idx" ON "returns" ("customer_id");
CREATE INDEX IF NOT EXISTS "returns_order_idx" ON "returns" ("order_id");
CREATE INDEX IF NOT EXISTS "returns_status_idx" ON "returns" ("status");

-- Müşteri bildirim tercihleri (portal Profil)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "preferences" jsonb NOT NULL DEFAULT '{}'::jsonb;
