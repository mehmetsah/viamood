-- Shipping rate yönetimi: vendor platform tek doğruluk kaynağı,
-- KargoLab base + margin → multi-channel (Shopify, WooCommerce, vs.) push.

CREATE TYPE "shipping_rate_status" AS ENUM ('draft', 'active', 'archived');

CREATE TABLE IF NOT EXISTS "shipping_rate_brackets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "weight_low_grams" integer NOT NULL DEFAULT 0,
  "weight_high_grams" integer NOT NULL,
  "country_code" text NOT NULL DEFAULT 'TR',
  "kargolab_base_cents" bigint,
  "kargolab_courier" text,
  "kargolab_fetched_at" jsonb,
  "margin_pct" integer NOT NULL DEFAULT 15,
  "margin_flat_cents" bigint DEFAULT 0,
  "price_cents" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'TRY',
  "status" "shipping_rate_status" NOT NULL DEFAULT 'draft',
  "shopify_method_id" text,
  "shopify_pushed_at" jsonb,
  "sort_order" integer NOT NULL DEFAULT 100,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "shipping_rate_brackets_country_status_idx"
  ON "shipping_rate_brackets" ("country_code", "status");
CREATE INDEX IF NOT EXISTS "shipping_rate_brackets_weight_idx"
  ON "shipping_rate_brackets" ("weight_low_grams", "weight_high_grams");

CREATE TABLE IF NOT EXISTS "shipment_syncs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopify_order_id" text NOT NULL,
  "shopify_order_name" text,
  "kargolab_shipment_id" text,
  "kargolab_tracking_number" text,
  "courier" text,
  "weight_grams" integer,
  "price_cents" bigint,
  "status" text NOT NULL DEFAULT 'pending',
  "error_message" text,
  "snapshot" jsonb DEFAULT '{}'::jsonb,
  "kargolab_response" jsonb,
  "synced_at" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "shipment_syncs_order_idx" ON "shipment_syncs" ("shopify_order_id");
CREATE INDEX IF NOT EXISTS "shipment_syncs_status_idx" ON "shipment_syncs" ("status");
CREATE INDEX IF NOT EXISTS "shipment_syncs_tracking_idx" ON "shipment_syncs" ("kargolab_tracking_number");

-- Seed: KargoLab brackets'tan otomatik dolduralım (varsayılan margin %15)
INSERT INTO "shipping_rate_brackets" (name, weight_low_grams, weight_high_grams, kargolab_base_cents, kargolab_courier, margin_pct, price_cents, status, sort_order)
VALUES
  ('Standart Kargo (0-3 kg)',    0,     3000,  8200,  'PTT', 15,  9500,  'active', 10),
  ('Standart Kargo (3-5 kg)',    3001,  5000,  10205, 'PTT', 15,  12000, 'active', 20),
  ('Standart Kargo (5-10 kg)',   5001,  10000, 11892, 'PTT', 15,  14500, 'active', 30),
  ('Standart Kargo (10-15 kg)',  10001, 15000, 18433, 'PTT', 15,  22000, 'active', 40),
  ('Standart Kargo (15-30 kg)',  15001, 30000, 31474, 'PTT', 15,  38000, 'active', 50)
ON CONFLICT DO NOTHING;
