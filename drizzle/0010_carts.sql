-- FAZ 2 Dilim 4 backend — native sepet / checkout-taslağı.
-- Shopify cart session + _tr_* attributes'in RDS karşılığı. Tema henüz dokunmuyor (additive). Elle yazıldı.

CREATE TABLE IF NOT EXISTS "carts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "token" text NOT NULL UNIQUE,
  "customer_id" text,
  "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "note" text,
  "status" text NOT NULL DEFAULT 'active',
  "converted_order_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "carts_status_idx" ON "carts" ("status");
CREATE INDEX IF NOT EXISTS "carts_customer_idx" ON "carts" ("customer_id");
