-- FAZ 1 — Müşteri katmanı: customers + customer_addresses.
-- Kimlik köprüsü = email (+ opsiyonel shopify_customer_id). orders tablosuna FK YOK (additive).
-- Elle yazıldı (db:generate, shipping.ts .default(0n) BigInt snapshot bug'ı nedeniyle kullanılmıyor;
-- bkz. 0006/0007 ile aynı manuel akış). Idempotent: IF NOT EXISTS + named constraint'ler.

CREATE TABLE IF NOT EXISTS "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "shopify_customer_id" text,
  "email" text NOT NULL,
  "name" text,
  "phone" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "customers_email_uniq" UNIQUE ("email")
);

CREATE INDEX IF NOT EXISTS "customers_shopify_idx" ON "customers" ("shopify_customer_id");
CREATE INDEX IF NOT EXISTS "customers_user_idx" ON "customers" ("user_id");

DO $$ BEGIN
  ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "customer_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" uuid NOT NULL,
  "label" text,
  "first_name" text,
  "last_name" text,
  "phone" text,
  "province" text,        -- il
  "district" text,        -- ilçe
  "neighborhood" text,    -- mahalle
  "address1" text,        -- açık adres
  "postal_code" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "shopify_address_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "cust_addr_dedup_uniq" UNIQUE ("customer_id", "address1", "district", "province", "neighborhood", "postal_code")
);

CREATE INDEX IF NOT EXISTS "cust_addr_customer_idx" ON "customer_addresses" ("customer_id");

DO $$ BEGIN
  ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk"
    FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
