-- store_settings: altyapı switch (backend) + tema ayarları. Idempotent.

ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "backend" text NOT NULL DEFAULT 'shopify';
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "theme" jsonb NOT NULL DEFAULT '{}'::jsonb;
