-- 0014_reviews — Müşteri yorumları (moderasyonlu). ELLE yazılmış idempotent migration.
-- HER deploy'da güvenle tekrar çalışır (IF NOT EXISTS). Additive — mevcut tablolara DOKUNMAZ.

CREATE TABLE IF NOT EXISTS "reviews" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source"         text NOT NULL DEFAULT 'customer',   -- 'customer' | 'seed'
  "status"         text NOT NULL DEFAULT 'pending',    -- 'pending' | 'approved' | 'rejected'
  "author_name"    text NOT NULL,
  "location"       text,
  "rating"         integer NOT NULL DEFAULT 5,
  "body"           text NOT NULL,
  "product_title"  text,
  "product_handle" text,
  "image_url"      text,
  "verified_buyer" boolean NOT NULL DEFAULT false,
  "customer_email" text,
  "order_name"     text,
  "source_image"   text,
  "ip_hash"        text,
  "moderated_by"   text,
  "moderated_at"   text,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  "deleted_at"     timestamptz
);

CREATE INDEX IF NOT EXISTS "reviews_status_idx"  ON "reviews" ("status");
CREATE INDEX IF NOT EXISTS "reviews_created_idx" ON "reviews" ("created_at");
CREATE INDEX IF NOT EXISTS "reviews_email_idx"   ON "reviews" ("customer_email");
