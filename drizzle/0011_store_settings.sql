-- Mağaza ayarları (ödeme yöntemleri + kargo) — admin'den yönetilir, storefront besler. Idempotent.

CREATE TABLE IF NOT EXISTS "store_settings" (
  "id" text PRIMARY KEY DEFAULT 'default',
  "payment" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "shipping" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "store_settings" ("id", "payment", "shipping")
VALUES ('default',
  '{"iyzico_enabled":true,"paytr_enabled":false,"havale_enabled":true,"cod_enabled":true,"card_gateway":"iyzico","cod_card_surcharge_pct":4}'::jsonb,
  '{"shipping_margin_tl":20}'::jsonb)
ON CONFLICT ("id") DO NOTHING;
