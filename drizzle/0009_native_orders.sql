-- FAZ 2 Dilim 1 — Native sipariş omurgası (havale+COD). Additive/güvenli.
-- orders: Shopify alanları nullable (native siparişte Shopify yok) + orderNumber/backend.
-- order_sequences: native numara sayacı (mikro_sequences deseni).
-- Elle yazıldı (db:generate kırık — bkz. 0008). Idempotent.

ALTER TABLE "orders" ALTER COLUMN "shopify_order_id" DROP NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "shopify_order_name" DROP NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_number" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "backend" text NOT NULL DEFAULT 'shopify';

-- order_number tekilliği (native; null Shopify satırları hariç)
CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_uniq"
  ON "orders" ("order_number") WHERE "order_number" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "order_sequences" (
  "key" text PRIMARY KEY,
  "value" integer NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "order_sequences" ("key", "value") VALUES ('native_order_no', 100000)
  ON CONFLICT ("key") DO NOTHING;
