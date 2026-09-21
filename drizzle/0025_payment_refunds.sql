-- Kart iadesi işlem kaydı (Halköde/PayTR/İyzico).
-- `returns` müşteri iade TALEBİ; burası PARA hareketinin kendisi.
-- Ekleme-only: başarısız denemeler de satır bırakır (17 Eyl "para gitti iz yok" dersi).
CREATE TABLE IF NOT EXISTS "payment_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid,
  "order_name" text,
  "invoice_id" text NOT NULL,
  "gateway" text DEFAULT 'halkode' NOT NULL,
  "amount_cents" bigint NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "status_code" text,
  "description" text,
  "raw" jsonb,
  "requested_by" text,
  "note" text,
  "shopify_noted" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_refunds_order_idx" ON "payment_refunds" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_refunds_invoice_idx" ON "payment_refunds" USING btree ("invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_refunds_status_idx" ON "payment_refunds" USING btree ("status");
